/* Karta pacienta – připojení telefonu kabelem přímo z prohlížeče (WebUSB, Chrome / Edge) a příprava kiosku.
   Stejné kroky jako android/nahrat-telefon.sh: instalace APK, správce zařízení (kiosk), spuštění Karty. */
import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import { PackageManager } from '@yume-chan/android-bin';

let adb = null;
export const podporovano = () => !!AdbDaemonWebUsbDeviceManager.BROWSER;
export async function pripoj() {
  const m = AdbDaemonWebUsbDeviceManager.BROWSER;
  if (!m) throw new Error('Tento prohlížeč neumí připojit telefon kabelem – otevřete stránku v Google Chrome nebo Microsoft Edge.');
  const device = await m.requestDevice();
  if (!device) throw new Error('Telefon nebyl vybrán.');
  let connection;
  try { connection = await device.connect(); }
  catch (e) { throw new Error('Telefon je obsazený jiným programem (adb / Android Studio). Zavřete Android Studio, v příkazové řádce spusťte „adb kill-server“, odpojte a připojte kabel a zkuste to znovu. (' + (e && e.message || e) + ')'); }
  const credentialStore = new AdbWebCredentialStore('Karta pacienta – nový telefon');
  const transport = await AdbDaemonTransport.authenticate({ serial: device.serial, connection, credentialStore });
  adb = new Adb(transport);
  return { serial: device.serial, model: (await shell('getprop ro.product.model')).trim(), android: (await shell('getprop ro.build.version.release')).trim() };
}
export async function shell(prikaz) {
  if (!adb) throw new Error('Telefon není připojený');
  return adb.subprocess.noneProtocol.spawnWaitText(prikaz);
}
export async function instaluj(bajty) {
  if (!adb) throw new Error('Telefon není připojený');
  const stream = new ReadableStream({ start(c) { const k = 64 * 1024; for (let i = 0; i < bajty.length; i += k) c.enqueue(bajty.subarray(i, i + k)); c.close(); } });
  await new PackageManager(adb).installStream(bajty.length, stream, { grantRuntimePermissions: true });
}
export async function odpoj() { if (adb) { try { await adb.close(); } catch { /* */ } adb = null; } }
