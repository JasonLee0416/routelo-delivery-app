import { NativeModule, requireNativeModule } from 'expo';
import {
  OnnxModelInfo,
  OnnxSmokeResult,
  PpOcrRecognitionResult,
} from './RouteloOnnx.types';

declare class RouteloOnnxModule extends NativeModule<{}> {
  isAvailable(): boolean;
  inspectBundledModel(assetName: string): Promise<OnnxModelInfo>;
  runFloatModel(
    assetName: string,
    inputName: string,
    values: number[],
    shape: number[],
  ): Promise<OnnxSmokeResult>;
  recognizeReceipt(imageUri: string): Promise<PpOcrRecognitionResult>;
}

export default requireNativeModule<RouteloOnnxModule>('RouteloOnnx');
