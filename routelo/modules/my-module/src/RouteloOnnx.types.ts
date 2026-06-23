export type OnnxTensorInfo = {
  name: string;
  type: string;
  shape: number[];
};

export type OnnxModelInfo = {
  runtimeVersion: string;
  modelAsset: string;
  inputs: OnnxTensorInfo[];
  outputs: OnnxTensorInfo[];
};

export type OnnxSmokeResult = {
  outputName: string;
  values: number[];
  processingMs: number;
};

export type PpOcrLine = {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type PpOcrRecognitionResult = {
  fullText: string;
  lines: PpOcrLine[];
  processingMs: number;
};
