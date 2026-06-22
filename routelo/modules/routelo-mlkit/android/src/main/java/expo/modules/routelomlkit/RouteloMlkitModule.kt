package expo.modules.routelomlkit

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RouteloMlkitModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RouteloMlkit")

    AsyncFunction("recognizeAsync") { uriString: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_MLKIT_CONTEXT", "Android application context is unavailable.", null)
        return@AsyncFunction
      }

      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uriString))
      } catch (error: Exception) {
        promise.reject("ERR_MLKIT_IMAGE", "Unable to open the captured receipt image.", error)
        return@AsyncFunction
      }

      val startedAt = System.currentTimeMillis()
      val recognizer = TextRecognition.getClient(
        KoreanTextRecognizerOptions.Builder().build()
      )

      recognizer.process(image)
        .addOnSuccessListener { result ->
          promise.resolve(
            mapOf(
              "fullText" to result.text,
              "lines" to result.textBlocks.flatMap { block ->
                block.lines.map { line -> line.toMap() }
              },
              "processingMs" to (System.currentTimeMillis() - startedAt)
            )
          )
        }
        .addOnFailureListener { error ->
          promise.reject("ERR_MLKIT_RECOGNITION", "Korean text recognition failed.", error)
        }
        .addOnCompleteListener {
          recognizer.close()
        }
    }
  }
}

private fun Text.Line.toMap(): Map<String, Any?> {
  val box = boundingBox
  val points = cornerPoints

  return mapOf(
    "text" to text,
    "boundingBox" to box?.let {
      mapOf(
        "x" to it.left,
        "y" to it.top,
        "width" to it.width(),
        "height" to it.height()
      )
    },
    "cornerPoints" to points?.map {
      mapOf("x" to it.x, "y" to it.y)
    }
  )
}
