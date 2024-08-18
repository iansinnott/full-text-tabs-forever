/**
 * For use in background.js - Handles requests from the UI, runs the model, then
 * sends back a response
 */

import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

export type TransformersProgress =
  | {
      status: "done" | "initiate" | "download";
      name: string;
      file: string;
    }
  | {
      status: "progress";
      name: string;
      file: string;
      progress: number;
      loaded: number;
      total: number;
    }
  | {
      status: "ready";
      task: string;
      model: string;
    };

// Skip initial check for local models, since we are not loading any local models.
env.allowLocalModels = false;

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
env.backends.onnx.wasm.numThreads = 1;

class PipelineSingleton {
  static task = "feature-extraction" as const;
  static model = "Xenova/all-MiniLM-L6-v2";
  static instance: FeatureExtractionPipeline | null = null;

  static async getInstance(progress_callback?: (x: TransformersProgress) => void) {
    if (this.instance === null) {
      console.time("loading pipeline");
      this.instance = await pipeline(this.task, this.model, { progress_callback });
      console.timeEnd("loading pipeline");
    }

    return this.instance;
  }
}

// Create generic classify function, which will be reused for the different types of events.
export const createEmbedding = async (text: string) => {
  // Get the pipeline instance. This will load and build the model when run for the first time.
  let model = await PipelineSingleton.getInstance((data) => {
    console.log("progress ::", data);
  });

  // Actually run the model on the input text
  let result = await model(text, { pooling: "mean", normalize: true });

  return result;
};
