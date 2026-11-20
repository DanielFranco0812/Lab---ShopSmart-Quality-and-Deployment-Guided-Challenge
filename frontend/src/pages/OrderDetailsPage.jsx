import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { peso } from './OrdersPage.jsx';

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const { user, checking } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    setOrder(null); setError('');
    api.getOrder(orderId).then((data) => active && setOrder(data)).catch((caught) => active && setError(caught.message));
    return () => { active = false; };
  }, [orderId, user]);

  if (checking) return <section><StatusMessage>Checking your account…</StatusMessage></section>;
  if (!user) return <Navigate to={`/account?next=/orders/${orderId}`} replace />;
  if (error) return <section><StatusMessage type="error">{error}</StatusMessage><Link to="/orders">Back to my orders</Link></section>;
  if (!order) return <section><StatusMessage>Loading order…</StatusMessage></section>;

  return (
    <section className="success-card">
      <p className="eyebrow">ORDER #{order.id} · {order.status}</p>
      <h1>{peso(order.total)}</h1>
      <p>{order.customerName} · {order.address}</p>
      <ul className="order-lines">
        {order.items.map((item) => <li key={item.productId}>{item.quantity} × {item.name} — {peso(item.unitPrice * item.quantity)}</li>)}
      </ul>
      <Link className="button" to="/orders">Back to my orders</Link>
    </section>
  );
}
