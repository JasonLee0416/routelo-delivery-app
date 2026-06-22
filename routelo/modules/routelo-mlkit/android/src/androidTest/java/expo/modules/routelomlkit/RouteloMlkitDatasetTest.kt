package expo.modules.routelomlkit

import android.content.ContentValues
import android.graphics.BitmapFactory
import android.os.Build
import android.provider.MediaStore
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.security.MessageDigest

@RunWith(AndroidJUnit4::class)
class RouteloMlkitDatasetTest {
  private val imageNames = listOf(
    "KakaoTalk_20260621_070828835.jpg",
    "KakaoTalk_20260621_070828835_01.jpg",
    "KakaoTalk_20260621_070828835_02.jpg",
    "KakaoTalk_20260621_070828835_03.jpg",
    "KakaoTalk_20260621_070828835_04.jpg",
    "KakaoTalk_20260621_070828835_05.jpg",
    "KakaoTalk_20260621_070828835_06.jpg",
    "KakaoTalk_20260621_070828835_07.jpg",
  )

  @Test
  fun recognizeRepositoryDataset() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val context = instrumentation.targetContext
    val recognizer = TextRecognition.getClient(
      KoreanTextRecognizerOptions.Builder().build()
    )
    val results = JSONArray()

    try {
      imageNames.forEach { imageName ->
        val bytes = instrumentation.context.assets.open(imageName).use { it.readBytes() }
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
          ?: error("Unable to decode $imageName")
        val startedAt = System.currentTimeMillis()
        val text = Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, 0)))
        val lines = JSONArray()

        text.textBlocks.forEach { block ->
          block.lines.forEach { line ->
            val box = line.boundingBox
            lines.put(
              JSONObject()
                .put("text", line.text)
                .put(
                  "boundingBox",
                  if (box == null) JSONObject.NULL else JSONObject()
                    .put("x", box.left)
                    .put("y", box.top)
                    .put("width", box.width())
                    .put("height", box.height())
                )
            )
          }
        }

        results.put(
          JSONObject()
            .put("file", imageName)
            .put("sha256", sha256(bytes))
            .put("width", bitmap.width)
            .put("height", bitmap.height)
            .put("processingMs", System.currentTimeMillis() - startedAt)
            .put("fullText", text.text)
            .put("lineCount", lines.length())
            .put("lines", lines)
        )
        bitmap.recycle()
      }
    } finally {
      recognizer.close()
    }

    val report = JSONObject()
      .put("schemaVersion", 1)
      .put("engine", "com.google.mlkit:text-recognition-korean:16.0.1")
      .put("device", JSONObject()
        .put("manufacturer", Build.MANUFACTURER)
        .put("model", Build.MODEL)
        .put("apiLevel", Build.VERSION.SDK_INT)
        .put("release", Build.VERSION.RELEASE))
      .put("sourceDirectory", "repository root copied unchanged into androidTest assets")
      .put("results", results)

    writeReportToDownloads(context.contentResolver, report.toString(2))

    assertEquals(imageNames.size, results.length())
  }

  private fun writeReportToDownloads(
    resolver: android.content.ContentResolver,
    report: String,
  ) {
    val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    resolver.delete(
      collection,
      "${MediaStore.MediaColumns.DISPLAY_NAME} = ?",
      arrayOf("ocr-benchmark-native.json")
    )
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, "ocr-benchmark-native.json")
      put(MediaStore.MediaColumns.MIME_TYPE, "application/json")
      put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/RouteloBenchmarks")
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val uri = requireNotNull(resolver.insert(collection, values)) {
      "Unable to create benchmark report in MediaStore"
    }
    resolver.openOutputStream(uri).use { stream ->
      requireNotNull(stream).write(report.toByteArray(Charsets.UTF_8))
    }
    values.clear()
    values.put(MediaStore.MediaColumns.IS_PENDING, 0)
    resolver.update(uri, values, null, null)
  }

  private fun sha256(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256")
      .digest(bytes)
      .joinToString("") { "%02x".format(it) }
}
