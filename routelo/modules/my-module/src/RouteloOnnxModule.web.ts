import { registerWebModule, NativeModule } from 'expo';
import {
  OnnxModelInfo,
  OnnxSmokeResult,
  PpOcrRecognitionResult,
} from './RouteloOnnx.types';

// RouteloOnnxModule is not available on the web platform.
class RouteloOnnxModule extends NativeModule<{}> {
  isAvailable() {
    return false;
  }

  async inspectBundledModel(_assetName: string): Promise<OnnxModelInfo> {
    throw new Error('ONNX Runtime is available only in the Android development build.');
  }

  async runFloatModel(
    _assetName: string,
    _inputName: string,
    _values: number[],
    _shape: number[],
  ): Promise<OnnxSmokeResult> {
    throw new Error('ONNX Runtime is available only in the Android development build.');
  }

  async recognizeReceipt(_imageUri: string): Promise<PpOcrRecognitionResult> {
    throw new Error('PP-OCR recognition is available only in the Android development build.');
  }
}

export default registerWebModule(RouteloOnnxModule, 'RouteloOnnx');
