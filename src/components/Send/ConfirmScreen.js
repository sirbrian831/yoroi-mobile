// @flow

import React from 'react'
import {compose} from 'redux'
import {connect} from 'react-redux'
import {ScrollView, View} from 'react-native'
import {withHandlers, withStateHandlers} from 'recompose'
import {SafeAreaView} from 'react-navigation'

import {
  Text,
  Button,
  OfflineBanner,
  ValidatedTextInput,
  StatusBar,
  Banner,
  PleaseWaitModal,
} from '../UiKit'
import {easyConfirmationSelector} from '../../selectors'
import walletManager, {SystemAuthDisabled} from '../../crypto/wallet'
import {SEND_ROUTES, WALLET_ROUTES, WALLET_INIT_ROUTES} from '../../RoutesList'
import {CONFIG} from '../../config'
import KeyStore from '../../crypto/KeyStore'
import {
  showErrorDialog,
  handleGeneralError,
  submitTransaction,
} from '../../actions'
import {withNavigationTitle, withTranslations} from '../../utils/renderUtils'
import {formatAdaWithSymbol, formatAdaWithText} from '../../utils/format'
import {NetworkError} from '../../api/errors'

import styles from './styles/ConfirmScreen.style'

import {WrongPassword} from '../../crypto/errors'
import {ignoreConcurrentAsyncHandler} from '../../utils/utils'

const getTranslations = (state) => state.trans.ConfirmSendAdaScreen

const handleOnConfirm = async (
  navigation,
  isEasyConfirmationEnabled,
  password,
  submitTransaction,
  setSendingTransaction,
) => {
  const transactionData = navigation.getParam('transactionData')

  const submitTx = async (decryptedKey) => {
    try {
      setSendingTransaction(true)
      await submitTransaction(decryptedKey, transactionData)

      navigation.navigate(WALLET_ROUTES.TX_HISTORY)
    } catch (e) {
      if (e instanceof NetworkError) {
        await showErrorDialog((dialogs) => dialogs.networkError)
      } else {
        throw e
      }
    } finally {
      setSendingTransaction(false)
    }
  }

  if (isEasyConfirmationEnabled) {
    try {
      await walletManager.ensureKeysValidity()
      navigation.navigate(SEND_ROUTES.BIOMETRICS_SIGNING, {
        keyId: walletManager._id,
        onSuccess: (decryptedKey) => {
          navigation.navigate(SEND_ROUTES.CONFIRM)

          submitTx(decryptedKey)
        },
        onFail: () => navigation.goBack(),
      })
    } catch (e) {
      if (e instanceof SystemAuthDisabled) {
        await walletManager.closeWallet()
        await showErrorDialog((dialogs) => dialogs.enableSystemAuthFirst)
        navigation.navigate(WALLET_INIT_ROUTES.WALLET_SELECTION)

        return
      } else {
        throw e
      }
    }

    return
  }

  try {
    const decryptedData = await KeyStore.getData(
      walletManager._id,
      'MASTER_PASSWORD',
      '',
      password,
    )

    submitTx(decryptedData)
  } catch (e) {
    if (e instanceof WrongPassword) {
      await showErrorDialog((dialogs) => dialogs.incorrectPassword)
    } else {
      handleGeneralError('Could not submit transaction', e)
    }
  }
}

const ConfirmScreen = ({
  onConfirm,
  translations,
  navigation,
  password,
  setPassword,
  isEasyConfirmationEnabled,
  sendingTransaction,
}) => {
  const amount = navigation.getParam('amount')
  const address = navigation.getParam('address')
  const transactionData = navigation.getParam('transactionData')
  const balanceAfterTx = navigation.getParam('balanceAfterTx')
  const availableAmount = navigation.getParam('availableAmount')

  const isConfirmationDisabled = !isEasyConfirmationEnabled && !password

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <View style={styles.root}>
        <StatusBar type="dark" />

        <OfflineBanner />
        <Banner
          label={translations.availableFundsBanner.label}
          text={formatAdaWithText(availableAmount)}
          boldText
        />

        <ScrollView style={styles.container}>
          <Text small>
            {translations.fees}: {formatAdaWithSymbol(transactionData.fee)}
          </Text>
          <Text small>
            {translations.balanceAfterTx}: {formatAdaWithSymbol(balanceAfterTx)}
          </Text>

          <Text style={styles.heading} small>
            {translations.receiver}
          </Text>
          <Text>{address}</Text>
          <Text style={styles.heading} small>
            {translations.amount}
          </Text>
          <Text>{formatAdaWithSymbol(amount)}</Text>

          {!isEasyConfirmationEnabled && (
            <View style={styles.input}>
              <ValidatedTextInput
                secureTextEntry
                value={password}
                label={translations.password}
                onChangeText={setPassword}
              />
            </View>
          )}
        </ScrollView>
        <View style={styles.actions}>
          <Button
            onPress={onConfirm}
            title={translations.confirmButton}
            disabled={isConfirmationDisabled}
          />
        </View>
      </View>

      <PleaseWaitModal
        title={translations.sendingModalTitle}
        spinnerText={translations.pleaseWait}
        visible={sendingTransaction}
      />
    </SafeAreaView>
  )
}

export default compose(
  connect(
    (state) => ({
      isEasyConfirmationEnabled: easyConfirmationSelector(state),
    }),
    {
      submitTransaction,
    },
  ),
  withTranslations(getTranslations),
  withStateHandlers(
    {
      password: CONFIG.DEBUG.PREFILL_FORMS ? CONFIG.DEBUG.PASSWORD : '',
      sendingTransaction: false,
    },
    {
      setPassword: (state) => (value) => ({password: value}),
      setSendingTransaction: () => (sendingTransaction) => ({
        sendingTransaction,
      }),
    },
  ),
  withNavigationTitle(({translations}) => translations.title),
  withHandlers({
    onConfirm: ignoreConcurrentAsyncHandler(
      ({
        navigation,
        isEasyConfirmationEnabled,
        password,
        submitTransaction,
        setSendingTransaction,
      }) => async (event) => {
        await handleOnConfirm(
          navigation,
          isEasyConfirmationEnabled,
          password,
          submitTransaction,
          setSendingTransaction,
        )
      },
      1000,
    ),
  }),
)(ConfirmScreen)
