import { NativeModule, requireNativeModule } from 'expo';

declare class IphoneDuoExpoRnModule extends NativeModule<{}> {}

export default requireNativeModule<IphoneDuoExpoRnModule>('IphoneDuoExpoRn');
