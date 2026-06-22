export type MlKitTextLine = {
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cornerPoints?: Array<{ x: number; y: number }>;
};

export type MlKitRecognitionResult = {
  fullText: string;
  lines: MlKitTextLine[];
  processingMs: number;
};
