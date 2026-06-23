package com.routelo.onnx

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.net.Uri
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import ai.onnxruntime.NodeInfo
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.FloatBuffer
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class RouteloOnnxModule : Module() {
  private val environment: OrtEnvironment by lazy {
    OrtEnvironment.getEnvironment()
  }
  private val sessions = mutableMapOf<String, OrtSession>()
  private val dictionary: List<String> by lazy {
    assetBytes(DICTIONARY_ASSET)
      .toString(Charsets.UTF_8)
      .lineSequence()
      .map(String::trimEnd)
      .filter(String::isNotEmpty)
      .toList()
  }

  override fun definition() = ModuleDefinition {
    Name("RouteloOnnx")

    Function("isAvailable") { true }

    AsyncFunction("inspectBundledModel") { assetName: String ->
      session(assetName).let { model ->
        mapOf(
          "runtimeVersion" to environment.version,
          "modelAsset" to assetName,
          "inputs" to model.inputInfo.map { (name, info) -> tensorInfo(name, info) },
          "outputs" to model.outputInfo.map { (name, info) -> tensorInfo(name, info) },
        )
      }
    }

    AsyncFunction("runFloatModel") {
        assetName: String,
        inputName: String,
        values: List<Double>,
        shape: List<Int> ->
      val startedAt = System.nanoTime()
      val floatValues = values.map(Double::toFloat).toFloatArray()
      val longShape = shape.map(Int::toLong).toLongArray()
      OnnxTensor.createTensor(
        environment,
        FloatBuffer.wrap(floatValues),
        longShape,
      ).use { inputTensor ->
        session(assetName).run(mapOf(inputName to inputTensor)).use { output ->
          mapOf(
            "outputName" to session(assetName).outputNames.first(),
            "values" to flattenNumbers(output[0].value),
            "processingMs" to elapsedMs(startedAt),
          )
        }
      }
    }

    AsyncFunction("recognizeReceipt") { imageUri: String ->
      val startedAt = System.nanoTime()
      val original = decodeOrientedBitmap(imageUri)
      try {
        val detection = detectTextBoxes(original)
        Log.i(
          LOG_TAG,
          "detector boxes=${detection.size} " +
            detection.take(8).joinToString(prefix = "[", postfix = "]") {
              "${it.left},${it.top},${it.width}x${it.height}"
            },
        )
        val lines = detection
          .sortedWith(compareBy<TextBox> { it.top / 24 }.thenBy { it.left })
          .take(MAX_BOXES)
          .mapNotNull { box ->
            val crop = Bitmap.createBitmap(
              original,
              box.left,
              box.top,
              box.width,
              box.height,
            )
            try {
              recognizeCrop(crop)?.let { recognized ->
                mapOf(
                  "text" to recognized.text,
                  "confidence" to recognized.confidence,
                  "boundingBox" to mapOf(
                    "x" to box.left,
                    "y" to box.top,
                    "width" to box.width,
                    "height" to box.height,
                  ),
                )
              }
            } finally {
              crop.recycle()
            }
          }
        mapOf(
          "fullText" to lines.joinToString("\n") { it["text"] as String },
          "lines" to lines,
          "processingMs" to elapsedMs(startedAt),
        )
      } finally {
        original.recycle()
      }
    }

    OnDestroy {
      sessions.values.forEach(OrtSession::close)
      sessions.clear()
    }
  }

  private fun decodeOrientedBitmap(imageUri: String): Bitmap {
    val context = requireNotNull(appContext.reactContext) {
      "React context is unavailable."
    }
    val uri = Uri.parse(imageUri)
    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
      ?: throw IllegalArgumentException("Unable to read image URI.")
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
      ?: throw IllegalArgumentException("Unable to decode receipt image.")
    val orientation = runCatching {
      ExifInterface(bytes.inputStream()).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL,
      )
    }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
    val rotation = when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (rotation == 0f) return bitmap
    val rotated = Bitmap.createBitmap(
      bitmap,
      0,
      0,
      bitmap.width,
      bitmap.height,
      Matrix().apply { postRotate(rotation) },
      true,
    )
    bitmap.recycle()
    return rotated
  }

  private fun detectTextBoxes(original: Bitmap): List<TextBox> {
    val scale = min(1f, DETECTOR_MAX_SIDE.toFloat() / max(original.width, original.height))
    val resizedWidth = max(32, ceil(original.width * scale / 32f).toInt() * 32)
    val resizedHeight = max(32, ceil(original.height * scale / 32f).toInt() * 32)
    val resized = Bitmap.createScaledBitmap(original, resizedWidth, resizedHeight, true)
    try {
      val values = FloatArray(3 * resizedWidth * resizedHeight)
      val pixels = IntArray(resizedWidth * resizedHeight)
      resized.getPixels(pixels, 0, resizedWidth, 0, 0, resizedWidth, resizedHeight)
      val plane = resizedWidth * resizedHeight
      pixels.forEachIndexed { index, pixel ->
        values[index] = ((Color.red(pixel) / 255f) - 0.485f) / 0.229f
        values[plane + index] = ((Color.green(pixel) / 255f) - 0.456f) / 0.224f
        values[plane * 2 + index] = ((Color.blue(pixel) / 255f) - 0.406f) / 0.225f
      }
      val model = session(DETECTOR_ASSET)
      OnnxTensor.createTensor(
        environment,
        FloatBuffer.wrap(values),
        longArrayOf(1, 3, resizedHeight.toLong(), resizedWidth.toLong()),
      ).use { tensor ->
        model.run(mapOf(model.inputNames.first() to tensor)).use { output ->
          val raw = output[0].value
          val dimensions = tensorDimensions(raw)
          require(dimensions.size >= 2) { "Unexpected detector output shape." }
          val mapHeight = dimensions[dimensions.size - 2]
          val mapWidth = dimensions.last()
          val probabilities = flattenNumbers(raw).map(Double::toFloat)
          val offset = probabilities.size - mapHeight * mapWidth
          val probabilityMap = probabilities.subList(offset, probabilities.size)
          val minimum = probabilityMap.minOrNull() ?: Float.NaN
          val maximum = probabilityMap.maxOrNull() ?: Float.NaN
          val average = probabilityMap.average()
          val aboveThreshold = probabilityMap.count { it >= DETECTOR_THRESHOLD }
          Log.i(
            LOG_TAG,
            "detector input=${resizedWidth}x$resizedHeight output=$dimensions " +
              "min=$minimum max=$maximum mean=$average " +
              "threshold=$DETECTOR_THRESHOLD above=$aboveThreshold/${probabilityMap.size}",
          )
          val candidates = DETECTOR_THRESHOLDS.map { threshold ->
            val boxes = projectedLineBoxes(
              probabilities,
              offset,
              mapWidth,
              mapHeight,
              original.width.toFloat() / mapWidth,
              original.height.toFloat() / mapHeight,
              threshold,
            ).filter { box ->
              box.height <= original.height * MAX_TEXT_LINE_HEIGHT_RATIO &&
                box.width * box.height <= original.width * original.height * MAX_BOX_AREA_RATIO
            }
            Log.i(
              LOG_TAG,
              "detector threshold=$threshold boxes=${boxes.size} " +
                boxes.take(5).joinToString(prefix = "[", postfix = "]") {
                  "${it.left},${it.top},${it.width}x${it.height}"
                },
            )
            boxes
          }
          return candidates
            .filter { it.isNotEmpty() }
            .maxByOrNull(::boxSetScore)
            .orEmpty()
        }
      }
    } finally {
      resized.recycle()
    }
  }

  private fun projectedLineBoxes(
    values: List<Float>,
    offset: Int,
    width: Int,
    height: Int,
    scaleX: Float,
    scaleY: Float,
    threshold: Float,
  ): List<TextBox> {
    val rowCounts = IntArray(height)
    for (y in 0 until height) {
      var count = 0
      val rowOffset = offset + y * width
      for (x in 0 until width) {
        if (values[rowOffset + x] >= threshold) count += 1
      }
      rowCounts[y] = count
    }
    val sortedRowCounts = rowCounts.sorted()
    val baseline = sortedRowCounts[(sortedRowCounts.lastIndex * 0.30f).roundToInt()]
    val peak = sortedRowCounts.lastOrNull() ?: 0
    // Use the document's own low-density background as the baseline. This
    // removes persistent table/border responses while retaining text-row peaks.
    val minimumActivePixels = max(
      width / 100,
      baseline + ((peak - baseline) * 0.18f).roundToInt(),
    )
    Log.i(
      LOG_TAG,
      "row projection threshold=$threshold baseline=$baseline peak=$peak activeMin=$minimumActivePixels",
    )

    val bands = mutableListOf<IntRange>()
    var bandStart = -1
    var lastActiveRow = -1
    for (y in 0 until height) {
      if (rowCounts[y] >= minimumActivePixels) {
        if (bandStart < 0) bandStart = y
        lastActiveRow = y
      } else if (bandStart >= 0 && y - lastActiveRow > MAX_ROW_GAP) {
        bands.add(bandStart..lastActiveRow)
        bandStart = -1
        lastActiveRow = -1
      }
    }
    if (bandStart >= 0) bands.add(bandStart..lastActiveRow)

    return bands.mapNotNull { band ->
      if (band.last - band.first + 1 < MIN_LINE_HEIGHT_PIXELS) return@mapNotNull null
      var minX = width
      var maxX = -1
      var activePixels = 0
      for (y in band) {
        val rowOffset = offset + y * width
        for (x in 0 until width) {
          if (values[rowOffset + x] >= threshold) {
            minX = min(minX, x)
            maxX = max(maxX, x)
            activePixels += 1
          }
        }
      }
      if (maxX < minX || activePixels < MIN_COMPONENT_PIXELS) return@mapNotNull null
      val bandHeight = band.last - band.first + 1
      val paddingX = max(3, (bandHeight * 0.8f).roundToInt())
      val paddingY = max(2, (bandHeight * 0.2f).roundToInt())
      val left = max(0, ((minX - paddingX) * scaleX).roundToInt())
      val top = max(0, ((band.first - paddingY) * scaleY).roundToInt())
      val right = min(
        (width * scaleX).roundToInt(),
        ((maxX + paddingX + 1) * scaleX).roundToInt(),
      )
      val bottom = min(
        (height * scaleY).roundToInt(),
        ((band.last + paddingY + 1) * scaleY).roundToInt(),
      )
      if (right - left < 10 || bottom - top < 8) {
        null
      } else {
        TextBox(left, top, right - left, bottom - top)
      }
    }
  }

  private fun connectedBoxes(
    values: List<Float>,
    offset: Int,
    width: Int,
    height: Int,
    scaleX: Float,
    scaleY: Float,
    threshold: Float,
  ): List<TextBox> {
    val visited = BooleanArray(width * height)
    val boxes = mutableListOf<TextBox>()
    val queue = IntArray(width * height)
    for (y in 0 until height) {
      for (x in 0 until width) {
        val start = y * width + x
        if (visited[start] || values[offset + start] < threshold) continue
        var head = 0
        var tail = 0
        queue[tail++] = start
        visited[start] = true
        var minX = x
        var maxX = x
        var minY = y
        var maxY = y
        var count = 0
        while (head < tail) {
          val current = queue[head++]
          val cx = current % width
          val cy = current / width
          count += 1
          minX = min(minX, cx)
          maxX = max(maxX, cx)
          minY = min(minY, cy)
          maxY = max(maxY, cy)
          for (dy in -1..1) {
            for (dx in -1..1) {
              val nx = cx + dx
              val ny = cy + dy
              if (nx !in 0 until width || ny !in 0 until height) continue
              val next = ny * width + nx
              if (!visited[next] && values[offset + next] >= threshold) {
                visited[next] = true
                queue[tail++] = next
              }
            }
          }
        }
        if (count < MIN_COMPONENT_PIXELS) continue
        val paddingX = max(2, ((maxX - minX + 1) * 0.08f).roundToInt())
        val paddingY = max(1, ((maxY - minY + 1) * 0.15f).roundToInt())
        val left = max(0, ((minX - paddingX) * scaleX).roundToInt())
        val top = max(0, ((minY - paddingY) * scaleY).roundToInt())
        val right = min(
          (width * scaleX).roundToInt(),
          ((maxX + paddingX + 1) * scaleX).roundToInt(),
        )
        val bottom = min(
          (height * scaleY).roundToInt(),
          ((maxY + paddingY + 1) * scaleY).roundToInt(),
        )
        if (right - left >= 10 && bottom - top >= 8) {
          boxes.add(TextBox(left, top, right - left, bottom - top))
        }
      }
    }
    return mergeOverlappingRows(boxes)
  }

  private fun mergeOverlappingRows(boxes: List<TextBox>): List<TextBox> {
    val sorted = boxes.sortedWith(compareBy<TextBox> { it.top }.thenBy { it.left })
    val merged = mutableListOf<TextBox>()
    sorted.forEach { box ->
      val rowIndex = merged.indexOfLast { row ->
        verticalOverlap(row, box) > 0.45f &&
          horizontalGap(row, box) < max(row.height, box.height) * 4
      }
      if (rowIndex >= 0) {
        val row = merged[rowIndex]
        val left = min(row.left, box.left)
        val top = min(row.top, box.top)
        val right = max(row.left + row.width, box.left + box.width)
        val bottom = max(row.top + row.height, box.top + box.height)
        merged[rowIndex] = TextBox(left, top, right - left, bottom - top)
      } else {
        merged.add(box)
      }
    }
    return merged.sortedWith(compareBy<TextBox> { it.top }.thenBy { it.left })
  }

  private fun horizontalGap(a: TextBox, b: TextBox): Int {
    val aRight = a.left + a.width
    val bRight = b.left + b.width
    return when {
      aRight < b.left -> b.left - aRight
      bRight < a.left -> a.left - bRight
      else -> 0
    }
  }

  private fun boxSetScore(boxes: List<TextBox>): Double {
    val usefulCount = min(boxes.size, MAX_BOXES)
    val averageAspectRatio = boxes
      .take(MAX_BOXES)
      .map { it.width.toDouble() / it.height.coerceAtLeast(1) }
      .average()
    val excessiveBoxPenalty = max(0, boxes.size - MAX_BOXES) * 0.5
    return usefulCount * min(averageAspectRatio, 8.0) - excessiveBoxPenalty
  }

  private fun verticalOverlap(a: TextBox, b: TextBox): Float {
    val overlap = max(
      0,
      min(a.top + a.height, b.top + b.height) - max(a.top, b.top),
    )
    return overlap.toFloat() / min(a.height, b.height).coerceAtLeast(1)
  }

  private fun recognizeCrop(crop: Bitmap): RecognizedText? {
    val targetWidth = min(
      RECOGNIZER_WIDTH,
      max(8, (crop.width * RECOGNIZER_HEIGHT.toFloat() / crop.height).roundToInt()),
    )
    val scaled = Bitmap.createScaledBitmap(crop, targetWidth, RECOGNIZER_HEIGHT, true)
    val canvas = Bitmap.createBitmap(
      RECOGNIZER_WIDTH,
      RECOGNIZER_HEIGHT,
      Bitmap.Config.ARGB_8888,
    )
    try {
      canvas.eraseColor(Color.WHITE)
      android.graphics.Canvas(canvas).drawBitmap(scaled, 0f, 0f, null)
      val pixels = IntArray(RECOGNIZER_WIDTH * RECOGNIZER_HEIGHT)
      canvas.getPixels(
        pixels,
        0,
        RECOGNIZER_WIDTH,
        0,
        0,
        RECOGNIZER_WIDTH,
        RECOGNIZER_HEIGHT,
      )
      val plane = RECOGNIZER_WIDTH * RECOGNIZER_HEIGHT
      val values = FloatArray(plane * 3)
      pixels.forEachIndexed { index, pixel ->
        values[index] = Color.red(pixel) / 127.5f - 1f
        values[plane + index] = Color.green(pixel) / 127.5f - 1f
        values[plane * 2 + index] = Color.blue(pixel) / 127.5f - 1f
      }
      val model = session(RECOGNIZER_ASSET)
      OnnxTensor.createTensor(
        environment,
        FloatBuffer.wrap(values),
        longArrayOf(1, 3, RECOGNIZER_HEIGHT.toLong(), RECOGNIZER_WIDTH.toLong()),
      ).use { tensor ->
        model.run(mapOf(model.inputNames.first() to tensor)).use { output ->
          val raw = output[0].value
          val dimensions = tensorDimensions(raw)
          require(dimensions.size >= 2) { "Unexpected recognizer output shape." }
          val steps = dimensions[dimensions.size - 2]
          val classes = dimensions.last()
          val logits = flattenNumbers(raw).map(Double::toFloat)
          val offset = logits.size - steps * classes
          val text = StringBuilder()
          var previous = -1
          var confidenceSum = 0f
          var confidenceCount = 0
          for (step in 0 until steps) {
            var bestIndex = 0
            var bestValue = -Float.MAX_VALUE
            for (character in 0 until classes) {
              val value = logits[offset + step * classes + character]
              if (value > bestValue) {
                bestValue = value
                bestIndex = character
              }
            }
            if (bestIndex != 0 && bestIndex != previous) {
              val dictionaryIndex = bestIndex - 1
              if (dictionaryIndex in dictionary.indices) {
                text.append(dictionary[dictionaryIndex])
                confidenceSum += bestValue
                confidenceCount += 1
              }
            }
            previous = bestIndex
          }
          val result = text.toString().trim()
          val confidence =
            if (confidenceCount == 0) 0f else confidenceSum / confidenceCount
          Log.i(
            LOG_TAG,
            "recognizer crop=${crop.width}x${crop.height} target=${targetWidth}x$RECOGNIZER_HEIGHT " +
              "output=$dimensions decodedLength=${result.length} confidence=$confidence " +
              "decoded=${result.take(32)}",
          )
          if (result.length < MIN_RECOGNIZED_TEXT_LENGTH || confidence < MIN_RECOGNITION_CONFIDENCE) {
            return null
          }
          return RecognizedText(result, confidence)
        }
      }
    } finally {
      scaled.recycle()
      canvas.recycle()
    }
  }

  private fun session(assetName: String): OrtSession =
    synchronized(sessions) {
      sessions.getOrPut(assetName) {
        environment.createSession(assetBytes(assetName))
      }
    }

  private fun assetBytes(assetName: String): ByteArray =
    appContext.reactContext
      ?.assets
      ?.open(assetName)
      ?.use { it.readBytes() }
      ?: throw IllegalStateException("React context is unavailable.")

  private fun tensorInfo(name: String, nodeInfo: NodeInfo): Map<String, Any> {
    val info = nodeInfo.info
    if (info !is TensorInfo) {
      return mapOf(
        "name" to name,
        "type" to info::class.java.simpleName,
        "shape" to emptyList<Long>(),
      )
    }
    return mapOf(
      "name" to name,
      "type" to info.type.toString(),
      "shape" to info.shape.toList(),
    )
  }

  private fun tensorDimensions(value: Any?): List<Int> = when (value) {
    is FloatArray -> listOf(value.size)
    is DoubleArray -> listOf(value.size)
    is Array<*> -> listOf(value.size) + tensorDimensions(value.firstOrNull())
    else -> emptyList()
  }

  private fun flattenNumbers(value: Any?): List<Double> {
    val result = mutableListOf<Double>()
    fun visit(item: Any?) {
      when (item) {
        null -> Unit
        is Number -> result.add(item.toDouble())
        is FloatArray -> item.forEach { result.add(it.toDouble()) }
        is DoubleArray -> item.forEach { result.add(it) }
        is IntArray -> item.forEach { result.add(it.toDouble()) }
        is LongArray -> item.forEach { result.add(it.toDouble()) }
        is Array<*> -> item.forEach(::visit)
        is Iterable<*> -> item.forEach(::visit)
        else -> throw IllegalArgumentException(
          "Unsupported ONNX output type: ${item::class.java.name}",
        )
      }
    }
    visit(value)
    return result
  }

  private fun elapsedMs(startedAt: Long) =
    (System.nanoTime() - startedAt) / 1_000_000.0

  private data class TextBox(
    val left: Int,
    val top: Int,
    val width: Int,
    val height: Int,
  )

  private data class RecognizedText(
    val text: String,
    val confidence: Float,
  )

  companion object {
    private const val LOG_TAG = "RouteloOnnx"
    private const val DETECTOR_ASSET = "models/ch_PP-OCRv5_det_mobile.onnx"
    private const val RECOGNIZER_ASSET = "models/korean_PP-OCRv5_rec_mobile.onnx"
    private const val DICTIONARY_ASSET = "models/ppocrv5_korean_dict.txt"
    private const val DETECTOR_MAX_SIDE = 1280
    private const val DETECTOR_THRESHOLD = 0.10f
    private val DETECTOR_THRESHOLDS = listOf(0.65f, 0.55f, 0.45f, 0.35f, 0.25f, 0.15f)
    private const val MAX_TEXT_LINE_HEIGHT_RATIO = 0.12f
    private const val MAX_BOX_AREA_RATIO = 0.18f
    private const val MAX_ROW_GAP = 3
    private const val MIN_LINE_HEIGHT_PIXELS = 2
    private const val MIN_COMPONENT_PIXELS = 2
    private const val MAX_BOXES = 96
    private const val RECOGNIZER_HEIGHT = 48
    private const val RECOGNIZER_WIDTH = 320
    private const val MIN_RECOGNIZED_TEXT_LENGTH = 3
    private const val MIN_RECOGNITION_CONFIDENCE = 0.55f
  }
}
