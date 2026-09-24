declare module '#auth-utils' {
  // External account ids of the owner, per service.
  interface User {
    spotify?: string
    ytmusic?: string
  }
}

export {}
