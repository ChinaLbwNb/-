// AudioWorklet 替代已弃用的 ScriptProcessorNode，用于采集 PCM 并发送到主线程
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channel = input[0];
      if (channel && channel.length > 0) {
        this.port.postMessage({ pcm: channel.slice(0) });
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
