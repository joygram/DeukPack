/**
 * DeukPack — public entry point.
 */

export * from './core/DeukPackEngine';
export * from './core/IdlParser';
export * from './core/DeukParser';
export * from './core/ProtoParser';
export * from './core/DeukPackGenerator';
// export * from './protocols/BinaryWriter';
export * from './serialization/WireSerializer';
export * from './serialization/WireDeserializer';
export * from './codegen/CodeGenerator';
export * from './codegen/CppGenerator';
export * from './codegen/CSharpGenerator';
export * from './types/DeukPackTypes';
export * from './protocols/WireProtocol';
export * from './protocols/JsonProtocol';

// Native bindings
export { NativeDeukPackEngine } from './native/NativeDeukPackEngine';

// Version info
export const VERSION = '1.0.0';
export const ENGINE_NAME = 'DeukPack';
