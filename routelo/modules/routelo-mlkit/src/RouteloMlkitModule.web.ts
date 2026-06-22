import { NativeModule, registerWebModule } from 'expo';

import { MlKitRecognitionResult } from './RouteloMlkit.types';

class RouteloMlkitModule extends NativeModule<{}> {
  async recognizeAsync(_uri: string): Promise<MlKitRecognitionResult> {
    throw new Error('ML Kit receipt recognition is available on Android only.');
  }
}

export default registerWebModule(RouteloMlkitModule, 'RouteloMlkit');
