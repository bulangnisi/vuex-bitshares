import API from '../../services/api';
import { types } from './mutations';

const actions = {
  /**
   * Logs in with password
   * @param {string} name - username
   * @param {string} password - user password
   */
  cloudLogin: async ({ commit }, { name, password }) => {
    // keys: { active, owner }
    const keys = API.Account.utils.generateKeysFromPassword({ name, password });
    const ownerPubkey = keys.owner.toPublicKey().toPublicKeyString('BTS');
    const userId = await API.Account.getAccountIdByOwnerPubkey(ownerPubkey);
    const id = userId && userId[0];
    if (id) {
      commit(types.ACCOUNT_CLOUD_LOGIN, { keys, userId: id });
      return { error: false };
    }
    return {
      error: true,
      message: 'Invalid username or password'
    };
  },

  /**
   * Logs in with brainkey & creates wallet
   * @param {string} password - user password
   * @param {string} brainkey - user brainkey
   */
  brainkeyLogin: async ({ commit }, { password, brainkey }) => {
    const userId = await API.Account.getAccountIdByBrainkey(brainkey);
    const id = userId && userId[0];

    if (id) {
      const wallet = API.Account.utils.createWallet({ password, brainkey });
      commit(types.ACCOUNT_BRAINKEY_LOGIN, {
        userId: id,
        wallet
      });
      return { error: false };
    }
    return { error: true };
  },

  /**
   * Signs up and logs in with username and password
   * @param {string} name - username
   * @param {string} password - user password
   */
  signupWithPassword: async ({ commit }, { name, password }) => {
    const keys = API.Account.utils.generateKeysFromPassword({ name, password });
    const result = await API.Account.createAccount({
      name,
      activeKey: keys.active,
      ownerKey: keys.owner
    });

    if (result.success) {
      const userId = result.id;
      const userType = 'password';

      commit(types.ACCOUNT_CLOUD_LOGIN, { keys, userId, userType });
      return { error: false };
    }

    return {
      error: true,
      message: result.error
    };
  },

  /**
 * Creates account & wallet for user
 * @param {string} name - user name
 * @param {string} password - user password
 * @param {string} dictionary - string to generate brainkey from
 */
  signupBrainkey: async ({ commit }, { name, password, dictionary, email }) => {
    const brainkey = API.Account.utils.suggestBrainkey(dictionary);
    const result = await API.Account.createAccountBrainkey({
      name,
      email,
      brainkey
    });
    if (result.success) {
      const userId = result.id;
      const wallet = API.Account.utils.createWallet({ password, brainkey });
      commit(types.ACCOUNT_SIGNUP, { wallet, userId });

      return { error: false };
    }
    return {
      error: true,
      message: result.error
    };
  },

  logout: ({ commit }) => {
    commit(types.ACCOUNT_LOGOUT);
  }
};


export default actions;
