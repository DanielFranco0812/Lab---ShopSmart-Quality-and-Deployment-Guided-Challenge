import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

export const peso = (amount) => `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function OrdersPage() {
  const { user, checking } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    api.getMyOrders().then((data) => active && setOrders(data.orders)).catch((caught) => active && setError(caught.message));
    return () => { active = false; };
  }, [user]);

  if (checking) return <section><StatusMessage>Checking your account…</StatusMessage></section>;
  if (!user) return <Navigate to="/account?next=/orders" replace />;

  return (
    <section>
      <div className="page-heading"><p className="eyebrow">ACCOUNT</p><h1>My orders</h1></div>
      <StatusMessage type="error">{error}</StatusMessage>
      {!orders && !error && <StatusMessage>Loading your orders…</StatusMessage>}
      {orders?.length === 0 && <div className="empty-state"><h2>No orders yet</h2><Link className="button" to="/">Browse products</Link></div>}
      {orders?.length > 0 && (
        <div className="cart-items">
          {orders.map((order) => (
            <article className="cart-item" key={order.id}>
              <div><h2>Order #{order.id}</h2><p>{new Date(order.createdAt).toLocaleString('en-PH')} · {order.items.length} item(s)</p></div>
              <strong>{peso(order.total)}</strong>
              <Link className="button secondary" to={`/orders/${order.id}`}>View</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
