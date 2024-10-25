import React, { useEffect, useState, useRef } from 'react';

const PTZControl = ({ cameraLabel, closeModal }) => {
  const constraints = {
    video: {
      pan: true,
      tilt: true,
      zoom: true
    }
  };

  const [action, setAction] = useState({
    pan: 0,
    tilt: 0,
    zoom: 0
  });
  
  const [mouseDownCommand, setMouseDownCommand] = useState({
    command: null,
    increment: null 
  });

  const [error, setError] = useState(false);
  const [track, setTrack] = useState(null);
  const actionRef = useRef(action);
  //const [mouseDown,setMouseDown] = useState(false);
  const mouseDownRef = useRef(false);
  const mouseDownCommandRef = useRef(false);
  const [applyConstraintsInProcess, setApplyConstraintsInProcess] = useState(false);
  const isMovingRef = useRef(false);

  useEffect(() => {
    connectCamera();
    return () => {
      if (track) {
        track.stop(); // Stop the track on component unmount
      }
    };
  }, []);

  useEffect(() => {
    actionRef.current = action; // Update the ref whenever action changes
  }, [action]);
  
  useEffect(() => {
    mouseDownCommandRef.current = mouseDownCommand; // Update the ref whenever action changes
  }, [mouseDownCommand]);
  
  // useEffect(() => {
  //   mouseDownRef.current = mouseDown; // Update the ref whenever action changes
  //   console.log("set mouse down")
  // }, [mouseDown]);

  const connectCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      handleSuccess(stream);
    } catch (e) {
      handleError(e);
    }
  };

  const handleSuccess = (stream) => {
    const [videoTrack] = stream.getVideoTracks();
    setTrack(videoTrack);
    const settings = videoTrack.getSettings();
    const capabilities = videoTrack.getCapabilities();
    console.log("capabilities");
    console.log(capabilities);
    setAction({
      pan: settings.pan || 0,
      tilt: settings.tilt || 0,
      zoom: settings.zoom || 0
    });
    const videoElement = document.getElementById('videoElement');
    videoElement.srcObject = stream; // Set the video element's source to the stream
  };

  const handleError = (error) => {
    console.error('Camera access error:', error);
    setError(true);
  };

  const applyConstraints = async (command, newVal) => {
    if (!track) {
      console.log('Camera track not found');
      return;
    }
    if (applyConstraintsInProcess) {
      console.log('Constraints apply in process, return:', applyConstraintsInProcess);
      //await new Promise(resolve => setTimeout(resolve, 300));
      return "failed";
    }
  
    setApplyConstraintsInProcess(true);
    const constraints = { advanced: [{ [command]: newVal }] };
  
    try {
      console.log("applying contrains",constraints)
      await track.applyConstraints(constraints); // Awaiting the constraint application
      setApplyConstraintsInProcess(false);
  
      // Update the action state
      setAction((prevAction) => ({
        ...prevAction,
        [command]: newVal
      }));
    } catch (err) {
      setApplyConstraintsInProcess(false);
      console.error('Error applying PTZ constraints', err);
      return "failed";
    }
  };


  const controlCamera = async (command, increment) => {
    if (error) return;
    console.log("control camera command",command,increment )
    const newVal = actionRef.current[command] + increment;
    return await applyConstraints(command, newVal);
  };

  const startContinuousMovement = async (command, increment) => {
    setMouseDownCommand({ command: command, increment: increment });
    if (error || isMovingRef.current) return;
    try {
      isMovingRef.current = true;
      
      const response = await controlCamera(command, increment);      
      if (response === 'failed') {
        console.log("failed cancelling this loop check");
        return;
      }
      let holdMultipler = 8;
      let resetMultiplier = false;
      while (mouseDownRef.current) {
        if (mouseDownCommandRef.current.command !== command || mouseDownCommandRef.current.increment !== increment) {
          console.log("changed current");
          command = mouseDownCommandRef.current.command;
          increment = mouseDownCommandRef.current.increment;
          holdMultipler = 1;
          resetMultiplier = true
        }
        const response = await controlCamera(command, increment * holdMultipler);      
        if (response === 'failed') {
          console.log("failed cancelling this loop");
          return;
        }
        if (resetMultiplier) {
          holdMultipler = 8;
          resetMultiplier = false;  // Reset the flag after resetting the multiplier
        }
      }
    } catch (err) {
      console.error("Error in continuous movement:", err);
    } finally {
      isMovingRef.current = false; // Always reset the flag when the function ends
    }
  };

  const stopMovement = () => {
    if (mouseDownRef.current) {
      mouseDownRef.current = null;
    }
  };

  const resetCamera = async () => {
    if (!track) {
      console.log('Camera track not found');
      return;
    }
    try {
      await applyConstraints('pan', 0);
      await applyConstraints('tilt', 0);
      await applyConstraints('zoom', 0);
      setAction({ pan: 0, tilt: 0, zoom: 0 });
      console.log('Camera reset to initial positions');
    } catch (error) {
      console.error('Failed to reset camera', error);
    }
  };

  return (
    <div className="ptz-modal">
      <div className="ptz-header">
        <span title='Close' className='closeBtn' onClick={closeModal}>x</span>
      </div>
      <video id="videoElement" autoPlay style={{ width: '640px', height: '480px', border: '1px solid #ccc', marginBottom: '20px' }} />
      <div className="ptz-controls">
        <button
          className="ptz-button"
          onMouseDown={() => {mouseDownRef.current= true; startContinuousMovement('tilt', 20000)}}
          onMouseUp={stopMovement}
          onMouseLeave={stopMovement}
        >↑</button>
        <div className="ptz-horizontal">
          <button
            className="ptz-button"
            onMouseDown={() =>  {mouseDownRef.current= true;  startContinuousMovement('pan', -20000)}}
            onMouseUp={stopMovement}
            onMouseLeave={stopMovement}
          >←</button>
          <button
            className="ptz-button"
            onMouseDown={() =>  {mouseDownRef.current= true;  startContinuousMovement('pan', 20000)}}
            onMouseUp={stopMovement}
            onMouseLeave={stopMovement}
          >→</button>
        </div>
        <button
          className="ptz-button"
          onMouseDown={() =>  {mouseDownRef.current= true;  startContinuousMovement('tilt', -20000)}}
          onMouseUp={stopMovement}
          onMouseLeave={stopMovement}
        >↓</button>
      </div>
      <div className="ptz-zoom">
        <button
          className="ptz-button"
          onMouseDown={() =>  {mouseDownRef.current= true; startContinuousMovement('zoom', 2000)}}
          onMouseUp={stopMovement}
          onMouseLeave={stopMovement}
        >+</button>
        <button
          className="ptz-button"
          onMouseDown={() =>  {mouseDownRef.current= true; startContinuousMovement('zoom', -2000)}}
          onMouseUp={stopMovement}
          onMouseLeave={stopMovement}
        >-</button>
      </div>
      <button className="ptz-button reset-button" onClick={resetCamera}>Reset</button>
      <span className='cameraName' title='Camera'>{cameraLabel}</span>
    </div>
  );
};

export default PTZControl;