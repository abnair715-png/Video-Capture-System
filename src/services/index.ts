export type ServiceContract = {
  readonly name: string;
};

export const services: ServiceContract[] = [];

export * from './authService';
export * from './cameraService';
export * from './metadataService';
