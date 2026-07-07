// Gedeelde debounce voor resize-handlers: voorkomt tientallen full redraws
// tijdens één resize of rotatie.
export function debounce(fn, delay = 150) {
  let timer = null
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
