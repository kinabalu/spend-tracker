import React, { Component } from 'react';
import plaid from 'plaid';
import PlaidLink from 'react-plaid-link';
import styles from './Home.css';

// TODO: Change these to your credentials
const CLIENT_ID = 'client-id';
const SECRET = 'secret';
const PUBLIC_KEY = 'public-key';

const KEY_ITEMS = 'items';

const getItems = () => {
  let items = JSON.parse(localStorage.getItem(KEY_ITEMS));
  if (!items) {
    items = {
      byId: {},
      allIds: [],
    };
    setItems(items);
  }

  return items;
};

const setItems = items => {
  localStorage.setItem(KEY_ITEMS, JSON.stringify(items));
};

const addItem = item => {
  const oldItems = getItems();
  if (oldItems.byId[item.id]) {
    return;
  }

  const items = {
    byId: {
      ...oldItems.byId,
      [item.id]: item,
    },
    allIds: [...oldItems.allIds, item.id],
  };

  setItems(items);
};

export default class Home extends Component {
  constructor(props) {
    super(props);

    this.state = {
      items: getItems(),
      balance: 0,
      loading: false,
      error: null,
    };

    this.client = new plaid.Client(CLIENT_ID, SECRET, PUBLIC_KEY, plaid.environments.sandbox);
  }

  componentWillMount() {
    this.fetchBalance();
  }

  fetchBalance() {
    const items = getItems();

    if (items.allIds.length > 0) {
      const item = items.byId[items.allIds[0]];
      const { accessToken } = item;
      this.setState({ ...this.state, loading: true });
      this.client
        .getBalance(accessToken, {})
        .then(res => {
          const balance = res.accounts.reduce((val, acct) => val + acct.balances.available, 0);
          this.setState({ ...this.state, balance, loading: false });
        })
        .catch(() => {
          this.setState({
            ...this.state,
            loading: false,
            error: 'Unable to get balance.',
          });
        });
    }
  }

  onItemLinked(publicToken, metadata) {
    const { institution_id: id, name } = metadata.institution;

    this.client
      .exchangePublicToken(publicToken)
      .then(res => {
        const { access_token: accessToken } = res;
        addItem({
          id,
          name,
          publicToken,
          accessToken,
        });

        this.fetchBalance();
      })
      .catch(() => {
        this.setState({
          ...this.state,
          error: 'Unable to authenticate with service',
        });
      });
  }

  render() {
    const { balance, loading, error } = this.state;
    const items = getItems();
    let value;
    if (loading) {
      value = 'Loading...';
    } else {
      value = `$${balance}`;
    }

    return (
      <div>
        <div className={styles.container} data-tid="container">
          {!error && (
            <div>
              <h1>Balance</h1>
              <h2>{value}</h2>
            </div>
          )}
          {error && <h3>{error}</h3>}
          {items.allIds.length < 1 && (
            <div>
              <h3>Link to your bank to view your account balance.</h3>
              <PlaidLink
                publicKey={PUBLIC_KEY}
                product="auth"
                env="sandbox"
                apiVersion={'v2'}
                clientName="Spend Tracker"
                onSuccess={this.onItemLinked.bind(this)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}
