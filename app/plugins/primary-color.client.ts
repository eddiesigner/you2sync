// Apply the saved primary color before the first page renders.
export default defineNuxtPlugin(() => {
  usePrimaryColor()
})
