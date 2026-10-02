import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { toArrayBuffer } from './encoding';

type CurveApi = {
  async: {
    calculateSignature(priv: ArrayBuffer, msg: ArrayBuffer): Promise<ArrayBuffer>;
    verifySignature(pub: ArrayBuffer, msg: ArrayBuffer, sig: ArrayBuffer): Promise<boolean>;
  };
};

let curve: Promise<CurveApi> | null = null;

// The package is CommonJS; depending on the bundler its default export is
// either the init function or the module object carrying it.
function getCurve(): Promise<CurveApi> {
  if (!curve) {
    let init = (libsignal as unknown as { default: unknown }).default;
    if (typeof init !== 'function') init = (init as { default: unknown }).default;
    curve = (init as () => Promise<{ Curve: CurveApi }>)().then((m) => m.Curve);
  }
  return curve;
}

/** XEdDSA signature with a Signal (Curve25519) identity key. */
export async function identitySign(identityPriv: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const c = await getCurve();
  return new Uint8Array(await c.async.calculateSignature(toArrayBuffer(identityPriv), toArrayBuffer(msg)));
}

export async function identityVerify(identityPub: Uint8Array, msg: Uint8Array, sig: Uint8Array): Promise<boolean> {
  const c = await getCurve();
  try {
    // The library throws on an invalid signature and resolves to `false`
    // (meaning "no failure") on a valid one.
    const failed = await c.async.verifySignature(toArrayBuffer(identityPub), toArrayBuffer(msg), toArrayBuffer(sig));
    return failed === false;
  } catch {
    return false;
  }
}
