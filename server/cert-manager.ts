import crypto from 'crypto'
import forge from 'node-forge'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getAppWritableDir() {
  if (typeof process.pkg !== 'undefined') {
    return path.dirname(process.execPath)
  }
  return path.join(__dirname, '..')
}

/** 获取证书目录（支持环境变量覆盖，用于 pkg 打包） */
function getCertDirPath() {
  return process.env.CERT_DIR || path.join(getAppWritableDir(), '.certs')
}
function getCAKeyPath() {
  return path.join(getCertDirPath(), 'ca.key.pem')
}
function getCACertPathInternal() {
  return path.join(getCertDirPath(), 'ca.cert.pem')
}

let caKeyForge: forge.pki.rsa.PrivateKey | null = null
let caCertForge: forge.pki.Certificate | null = null
const certCache = new Map<string, { key: string; cert: string }>()

/** 使用 Node.js 原生 crypto 快速生成 RSA 密钥对 */
function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  })
  return {
    privateKey: forge.pki.privateKeyFromPem(privateKey),
    publicKey: forge.pki.publicKeyFromPem(publicKey),
    privateKeyPem: privateKey,
  }
}

/** 确保 CA 根证书存在（首次启动自动生成） */
export function ensureCA() {
  if (caKeyForge && caCertForge) return

  if (!fs.existsSync(getCertDirPath()))
    fs.mkdirSync(getCertDirPath(), { recursive: true })

  if (fs.existsSync(getCAKeyPath()) && fs.existsSync(getCACertPathInternal())) {
    caKeyForge = forge.pki.privateKeyFromPem(
      fs.readFileSync(getCAKeyPath(), 'utf-8'),
    )
    caCertForge = forge.pki.certificateFromPem(
      fs.readFileSync(getCACertPathInternal(), 'utf-8'),
    )
    return
  }

  console.log('  [CA] 首次启动，正在生成 CA 根证书...')
  const { privateKey, publicKey } = generateKeyPair()

  const cert = forge.pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)

  const attrs = [
    { name: 'commonName', value: 'Dev Mock API CA' },
    { name: 'organizationName', value: 'Dev Mock API' },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    {
      name: 'keyUsage',
      keyCertSign: true,
      cRLSign: true,
    },
  ])
  cert.sign(privateKey, forge.md.sha256.create())

  caKeyForge = privateKey
  caCertForge = cert

  fs.writeFileSync(getCAKeyPath(), forge.pki.privateKeyToPem(privateKey))
  fs.writeFileSync(getCACertPathInternal(), forge.pki.certificateToPem(cert))
  console.log('  [CA] CA 根证书已生成:', getCACertPathInternal())
}

/** 为指定域名生成 TLS 证书（CA 签发） */
export function getCert(hostname: string) {
  ensureCA()

  if (certCache.has(hostname)) return certCache.get(hostname)!

  const { publicKey, privateKeyPem } = generateKeyPair()

  const cert = forge.pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = Date.now().toString(16)
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

  cert.setSubject([{ name: 'commonName', value: hostname }])
  cert.setIssuer(caCertForge!.subject.attributes)
  cert.setExtensions([
    {
      name: 'subjectAltName',
      altNames: [{ type: 2, value: hostname }],
    },
  ])
  cert.sign(caKeyForge!, forge.md.sha256.create())

  const result = {
    key: privateKeyPem,
    cert: forge.pki.certificateToPem(cert),
  }

  certCache.set(hostname, result)
  return result
}

/** 获取 CA 证书文件路径 */
export function getCACertPath() {
  ensureCA()
  return getCACertPathInternal()
}
