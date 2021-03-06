// @flow
import ExtendableError from 'es6-error'

export class CardanoError extends ExtendableError {}

export class WrongPassword extends ExtendableError {
  constructor() {
    super('WrongPassword')
  }
}

export class InsufficientFunds extends ExtendableError {
  constructor() {
    super('InsufficientFunds')
  }
}

export const _rethrow = <T>(x: Promise<T>): Promise<T> =>
  x.catch((e) => {
    throw new CardanoError(e.message)
  })
