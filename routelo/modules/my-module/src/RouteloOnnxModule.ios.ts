import { OnnxModelInfo, OnnxSmokeResult } from './RouteloOnnx.types';

const RouteloOnnxModule = {
  isAvailable() {
    return false;
  },

  async inspectBundledModel(_assetName: string): Promise<OnnxModelInfo> {
    throw new Error('The PP-OCR compatibility spike currently supports Android only.');
  },

  async runFloatModel(
    _assetName: string,
    _inputName: string,
    _values: number[],
    _shape: number[],
  ): Promise<OnnxSmokeResult> {
    throw new Error('The PP-OCR compatibility spike currently supports Android only.');
  },
};

export default RouteloOnnxModule;
