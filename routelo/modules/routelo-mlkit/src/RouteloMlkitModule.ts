import { NativeModule, requireNativeModule } from 'expo';

import { MlKitRecognitionResult } from './RouteloMlkit.types';

declare class RouteloMlkitModule extends NativeModule<{}> {
  recognizeAsync(uri: string): Promise<MlKitRecognitionResult>;
}

export default requireNativeModule<RouteloMlkitModule>('RouteloMlkit');
