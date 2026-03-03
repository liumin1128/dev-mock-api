const crypto = require("crypto");
const forge = require("node-forge");
const fs = require("fs");
const path = require("path");

const CERT_DIR = path.join(__dirname, "..", ".certs");
const CA_KEY_PATH = path.join(CERT_DIR, "ca.key.pem");
const CA_CERT_PATH = path.join(CERT_DIR, "ca.cert.pem");

let caKeyForge = null;
let caCertForge = null;
const certCache = new Map();

/** 使用 Node.js 原生 crypto 快速生成 RSA 密钥对 */
function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  return {
    privateKey: forge.pki.privateKeyFromPem(privateKey),
    publicKey: forge.pki.publicKeyFromPem(publicKey),
    privateKeyPem: privateKey,
  };
}

/** 确保 CA 根证书存在（首次启动自动生成） */
function ensureCA() {
  if (caKeyForge && caCertForge) return;

  if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

  // 尝试加载已有 CA
  if (fs.existsSync(CA_KEY_PATH) && fs.existsSync(CA_CERT_PATH)) {
    caKeyForge = forge.pki.privateKeyFromPem(
      fs.readFileSync(CA_KEY_PATH, "utf-8"),
    );
    caCertForge = forge.pki.certificateFromPem(
      fs.readFileSync(CA_CERT_PATH, "utf-8"),
    );
    return;
  }

  // 生成新的 CA 根证书
  console.log("  [CA] 首次启动，正在生成 CA 根证书...");
  const { privateKey, publicKey } = generateKeyPair();

  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(
    Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
  );

  const attrs = [
    { name: "commonName", value: "Dev Mock API CA" },
    { name: "organizationName", value: "Dev Mock API" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true },
  ]);
  cert.sign(privateKey, forge.md.sha256.create());

  caKeyForge = privateKey;
  caCertForge = cert;

  fs.writeFileSync(CA_KEY_PATH, forge.pki.privateKeyToPem(privateKey));
  fs.writeFileSync(CA_CERT_PATH, forge.pki.certificateToPem(cert));
  console.log("  [CA] CA 根证书已生成:", CA_CERT_PATH);
}

/** 为指定域名生成 TLS 证书（CA 签发） */
function getCert(hostname) {
  ensureCA();

  if (certCache.has(hostname)) return certCache.get(hostname);

  const { privateKey, publicKey, privateKeyPem } = generateKeyPair();

  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  cert.setSubject([{ name: "commonName", value: hostname }]);
  cert.setIssuer(caCertForge.subject.attributes);
  cert.setExtensions([
    {
      name: "subjectAltName",
      altNames: [{ type: 2, value: hostname }],
    },
  ]);
  cert.sign(caKeyForge, forge.md.sha256.create());

  const result = {
    key: privateKeyPem,
    cert: forge.pki.certificateToPem(cert),
  };

  certCache.set(hostname, result);
  return result;
}

/** 获取 CA 证书文件路径（供用户安装信任） */
function getCACertPath() {
  ensureCA();
  return CA_CERT_PATH;
}

module.exports = { getCert, getCACertPath, ensureCA };
