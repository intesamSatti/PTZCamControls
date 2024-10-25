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
  const [capabilities, setCapabilities] = useState(null);
  const panIncrement = useRef(0);
  const tiltIncrement = useRef(0);
  const zoomIncrement = useRef(0);

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
    setCapabilities(capabilities);
    calculateIncrements(capabilities);
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

  const calculateIncrements = (capabilities) => {
    if (capabilities.pan) {
        const panRange = capabilities.pan.max - capabilities.pan.min;
        panIncrement.current = panRange * 0.03;
    }

    if (capabilities.tilt) {
        const tiltRange = capabilities.tilt.max - capabilities.tilt.min;
        tiltIncrement.current = tiltRange * 0.03;
    }

    if (capabilities.zoom) {
        const zoomRange = capabilities.zoom.max - capabilities.zoom.min;
        zoomIncrement.current = zoomRange * 0.03;
    }

    console.log(`Pan Increment: ${panIncrement.current}`);
    console.log(`Tilt Increment: ${tiltIncrement.current}`);
    console.log(`Zoom Increment: ${zoomIncrement.current}`);
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
      return "failed";
    }
  
    setApplyConstraintsInProcess(true);
    
    if (!capabilities || !capabilities.pan || !capabilities.tilt || !capabilities.zoom) {
      //console.log('Capabilities not available yet or incomplete');
      setApplyConstraintsInProcess(false);
      return "failed";
    }
  
    let adjustedValue = newVal;
  
    switch (command) {
      case 'pan':
        adjustedValue = Math.min(Math.max(newVal, capabilities.pan.min), capabilities.pan.max);
        break;
      case 'tilt':
        adjustedValue = Math.min(Math.max(newVal, capabilities.tilt.min), capabilities.tilt.max);
        break;
      case 'zoom':
        adjustedValue = Math.min(Math.max(newVal, capabilities.zoom.min), capabilities.zoom.max);
        break;
      default:
        console.error('Invalid command:', command);
        setApplyConstraintsInProcess(false);
        return "failed";
    }
    if(adjustedValue !== newVal){
      console.log("DDDOOONNEEEEEEEEEEEE ADDDJUST",adjustedValue,newVal);
    }
    const currentActionValue = actionRef.current[command];
    if (adjustedValue === currentActionValue) {
      setApplyConstraintsInProcess(false);
      //console.log(`No change for ${command}, already at ${adjustedValue}`);
      return "failed";
    }
  
    const constraints = { advanced: [{ [command]: adjustedValue }] };
  
    try {
      console.log("applying constraints", constraints);
      await track.applyConstraints(constraints); // Awaiting the constraint application
      setApplyConstraintsInProcess(false);
  
      setAction((prevAction) => ({
        ...prevAction,
        [command]: adjustedValue
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
        //console.log("failed cancelling this loop check");
        return;
      }
      let holdMultipler = 7;
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
          holdMultipler = 7;
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
          onMouseDown={() => {mouseDownRef.current= true; startContinuousMovement('tilt', tiltIncrement.current)}}
          onMouseUp={stopMovement}
          onMouseLeave={stopMovement}
        >↑</button>
        <div className="ptz-horizontal">
          <button
            className="ptz-button"
            onMouseDown={() =>  {mouseDownRef.current= true;  startContinuousMovement('pan', -panIncrement.current)}}
            onMouseUp={stopMovement}
            onMouseLeave={stopMovement}
          >←</button>
          <button
            className="ptz-button"
            onMouseDown={() =>  {mouseDownRef.current= true;  startContinuousMovement('pan', panIncrement.current)}}
            onMouseUp={stopMovement}
            onMouseLeave={stopMovement}
          >→</button>
        </div>
        <button
          className="ptz-button"
          onMouseDown={() =>  {mouseDownRef.current= true;  startContinuousMovement('tilt', -tiltIncrement.current)}}
          onMouseUp={stopMovement}
          onMouseLeave={stopMovement}
        >↓</button>
      </div>
      <div className="ptz-zoom">
        <button
          className="ptz-button"
          onMouseDown={() =>  {mouseDownRef.current= true; startContinuousMovement('zoom', zoomIncrement.current)}}
          onMouseUp={stopMovement}
          onMouseLeave={stopMovement}
        >+</button>
        <button
          className="ptz-button"
          onMouseDown={() =>  {mouseDownRef.current= true; startContinuousMovement('zoom', -zoomIncrement.current)}}
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