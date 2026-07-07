let __visionModulePromise = null;
function loadVisionModule(){
  if(!__visionModulePromise){
    __visionModulePromise = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9');
  }
  return __visionModulePromise;
}
