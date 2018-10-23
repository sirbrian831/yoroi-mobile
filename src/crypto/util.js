// @flow

import {mnemonicToEntropy, generateMnemonic} from 'bip39'
import {HdWallet, Wallet, PasswordProtect} from 'rust-cardano-crypto'
import {randomBytes} from 'react-native-randombytes'
import ExtendableError from 'es6-error'
import bs58 from 'bs58'
import cryptoRandomString from 'crypto-random-string'

import {CONFIG} from '../config'

export type AddressType = 'Internal' | 'External'

export type CryptoAccount = {
  root_cached_key: string,
  derivation_scheme: string,
}

export class CardanoError extends ExtendableError {}

export const _result = <T>(rustResult: {
  failed: boolean,
  result: T,
  msg: string,
}): T => {
  if (rustResult.failed) throw new CardanoError(rustResult.msg)
  return rustResult.result
}

export const getMasterKeyFromMnemonic = (mnemonic: string) => {
  const entropy = new Buffer(mnemonicToEntropy(mnemonic), 'hex')
  const masterKey = HdWallet.fromEnhancedEntropy(entropy, '')
  return masterKey
}

export const getAccountFromMasterKey = (
  masterKey: Buffer,
  magic: number = CONFIG.CARDANO.PROTOCOL_MAGIC,
): CryptoAccount => {
  const wallet = _result(Wallet.fromMasterKey(masterKey))
  wallet.config.protocol_magic = magic
  return _result(Wallet.newAccount(wallet, 0))
}

export const encryptMasterKey = (
  password: string,
  masterKey: Uint8Array,
): string => {
  const salt = new Buffer(cryptoRandomString(2 * 32), 'hex')
  const nonce = new Buffer(cryptoRandomString(2 * 12), 'hex')
  const formattedPassword: Uint8Array = new TextEncoder().encode(password)
  const encryptedBytes = PasswordProtect.encryptWithPassword(
    formattedPassword,
    salt,
    nonce,
    masterKey,
  )
  const encryptedHex = Buffer.from(encryptedBytes).toString('hex')
  return encryptedHex
}

export const decryptMasterKey = (
  password: string,
  encryptedHex: string,
): Uint8Array => {
  const encryptedBytes = new Buffer(encryptedHex, 'hex')
  const formattedPassword: Uint8Array = new TextEncoder().encode(password)
  // prettier-ignore
  const decryptedBytes:
    | ?Uint8Array
    | false = PasswordProtect.decryptWithPassword(
      formattedPassword,
      encryptedBytes,
    )
  if (!decryptedBytes) {
    throw new CardanoError('Wrong password')
  }

  return decryptedBytes
}

const _getAddresses = (
  account: CryptoAccount,
  type: AddressType,
  indexes: Array<number>,
) => _result(Wallet.generateAddresses(account, type, indexes))

export const getExternalAddresses = (
  account: CryptoAccount,
  indexes: Array<number>,
) => _getAddresses(account, 'External', indexes)

export const getInternalAddresses = (
  account: CryptoAccount,
  indexes: Array<number>,
) => _getAddresses(account, 'Internal', indexes)

export const getAddressInHex = (address: string): string => {
  try {
    return bs58.decode(address).toString('hex')
  } catch (err) {
    throw new CardanoError(err.message)
  }
}

export const isValidAddress = (address: string): boolean => {
  try {
    return _result(Wallet.checkAddress(getAddressInHex(address)))
  } catch (e) {
    if (e instanceof CardanoError) return false
    throw e
  }
}

export const generateAdaMnemonic = () =>
  generateMnemonic(CONFIG.MNEMONIC_STRENGTH, randomBytes)