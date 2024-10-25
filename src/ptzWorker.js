let track;

self.onmessage = async (event) => {
  const { command, value } = event.data;
  console.log("command",command)
  if (command === 'setTrack') {
    track = value;
  } else if (track && command) {
    const constraints = { advanced: [{ [command]: 70000 }] };
    try {
      await track.applyConstraints(constraints);
      self.postMessage({ command, value });
    } catch (error) {
      self.postMessage({ error: `Failed to apply ${command} constraint: ${error}` });
    }
  }
};