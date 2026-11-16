import { useState, useEffect } from 'react';
import { vendorService } from '../../api/vendorService';
import { StatusBadge, Skeleton } from '../../components/common';
import { formatDateTime, formatCurrency, formatSlot } from '../../utils/formatters';
import { useLiveOrders } from '../../context/LiveOrdersContext';
import {
  X, Package, User, MapPin, Truck, Clock,
  CheckCircle, XCircle, ArrowRight, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── Status transition map (mirrors backend) ─────────────────────────── */
const STATUS_TRANSITIONS = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed:    ['shipped', 'cancelled'],
  shipped:   ['delivered'],
  delivered: [],
  cancelled: [],
};

// Collection orders are made ready, then handed over (no shipping)
const COLLECTION_TRANSITIONS = {
  pending:              ['confirmed', 'cancelled'],
  confirmed:            ['ready_for_collection', 'packed', 'cancelled'],
  packed:               ['ready_for_collection', 'cancelled'],
  ready_for_collection: ['collected', 'cancelled'],
  collected:            [],
  cancelled:            [],
};

const STATUS_BUTTON_STYLES = {
  confirmed: { className: 'btn btn-primary',  icon: CheckCircle, label: 'Confirm Order' },
  packed:    { className: 'btn btn-primary',  icon: Package,     label: 'Mark Packed' },
  shipped:   { className: 'btn btn-primary',  icon: Truck,       label: 'Mark Shipped' },
  delivered: { className: 'btn btn-success',  icon: CheckCircle, label: 'Mark Delivered' },
  ready_for_collection: { className: 'btn btn-primary', icon: Package, label: 'Ready to Collect' },
  collected: { className: 'btn btn-success',  icon: CheckCircle, label: 'Handed Over' },
  cancelled: { className: 'btn btn-danger',   icon: XCircle,     label: 'Cancel Order' },
};

export default function OrderDetailDrawer({ orderId, open, onClose, onStatusChanged }) {
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [riders, setRiders] = useState([]);
  const [idType, setIdType] = useState('');
  const [itemEdit, setItemEdit] = useState(null); // { index, action, quantity, productId, variantId }
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!open) return;
    vendorService.getRiders().then((r) => setRiders(r?.data || [])).catch(() => setRiders([]));
  }, [open]);

  const assign = async (riderId) => {
    try {
      const res = await vendorService.assignRider(orderId, riderId || null);
      toast.success(res.message);
      fetchOrder();
      onStatusChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't assign the rider");
    }
  };

  const openItemEdit = async (index, action) => {
    setItemEdit({ index, action, quantity: String(order.items[index].quantity), productId: '', variantId: '' });
    if (action === 'substitute' && products.length === 0) {
      const res = await vendorService.getProducts({ limit: 100 }).catch(() => null);
      setProducts(res?.data || []);
    }
  };

  const saveItemEdit = async () => {
    const { index, action, quantity, productId, variantId } = itemEdit;
    const body = action === 'unavailable'
      ? { action, quantity: Number(quantity) }
      : { action, productId, ...(variantId ? { variantId } : {}) };
    try {
      const res = await vendorService.adjustOrderItem(orderId, index, body);
      toast.success(res.message);
      setItemEdit(null);
      fetchOrder();
      onStatusChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't change that item");
    }
  };

  useEffect(() => {
    if (open && orderId) {
      fetchOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  // Arrival or a change from another device: reload this order if it's open
  useLiveOrders((event, payload) => {
    if (open && orderId && payload?.orderId === String(orderId) && event !== 'order:created') fetchOrder();
  });

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const [orderRes, historyRes] = await Promise.all([
        vendorService.getOrder(orderId),
        vendorService.getOrderHistory(orderId),
      ]);
      setOrder(orderRes.data);
      setHistory(historyRes.data?.statusHistory || []);
    } catch {
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (nextStatus) => {
    // Age-restricted goods are handed over only after a photo-ID check
    if (['delivered', 'collected'].includes(nextStatus) && order?.ageCheck > 0 && !idType) {
      toast.error(`Pick the photo ID you checked (${order.ageCheck}+) first`);
      return;
    }
    try {
      setUpdating(true);
      const payload = { orderStatus: nextStatus, note: note.trim() || undefined };
      if (['delivered', 'collected'].includes(nextStatus) && order?.ageCheck > 0) {
        payload.ageVerified = true;
        payload.idType = idType;
      }

      if (nextStatus === 'shipped') {
        payload.tracking = {};
        if (trackingCarrier) payload.tracking.carrier = trackingCarrier;
        if (trackingNumber) payload.tracking.trackingNumber = trackingNumber;
        if (trackingUrl) payload.tracking.trackingUrl = trackingUrl;
      }
      if (nextStatus === 'cancelled' && cancellationReason) {
        payload.tracking = { cancellationReason };
      }

      await vendorService.updateOrderStatus(orderId, payload);
      toast.success(`Order status updated to ${nextStatus}`);
      setNote('');
      setTrackingCarrier('');
      setTrackingNumber('');
      setTrackingUrl('');
      setCancellationReason('');
      await fetchOrder();
      onStatusChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (!open) return null;

  const transitions = order?.fulfilment?.method === 'collection' ? COLLECTION_TRANSITIONS : STATUS_TRANSITIONS;
  const nextStatuses = order ? (transitions[order.orderStatus] || []) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 'var(--z-overlay)', transition: 'opacity 0.2s',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="animate-slide-in"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 620,
          background: '#fff', zIndex: 'var(--z-modal)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--gray-200)',
          background: 'var(--gray-50)',
        }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--gray-900)' }}>
            Order Detail
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)' }}>
          {loading ? (
            <div>
              <Skeleton variant="text" width="60%" height="1.2rem" />
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Skeleton variant="rect" height={100} />
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Skeleton variant="rect" height={200} />
              </div>
            </div>
          ) : order ? (
            <>
              {/* ── Order Summary ── */}
              <div className="order-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--gray-900)' }}>
                      #{order.orderNumber}
                    </h3>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                      {formatDateTime(order.createdAt)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <StatusBadge status={order.orderStatus} />
                    <StatusBadge status={order.paymentStatus} label={`Pay: ${order.paymentStatus}`} />
                  </div>
                </div>

                {/* Totals */}
                <div className="order-info-grid" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="order-info-item">
                    <label>Subtotal</label>
                    <span>{formatCurrency(order.subtotal || 0)}</span>
                  </div>
                  <div className="order-info-item">
                    <label>Shipping Fee</label>
                    <span>{formatCurrency(order.shippingFee || 0)}</span>
                  </div>
                  <div className="order-info-item">
                    <label>Total</label>
                    <span style={{ fontWeight: 700 }}>{formatCurrency(order.total || 0)}</span>
                  </div>
                  <div className="order-info-item">
                    <label>Payment Method</label>
                    <span style={{ textTransform: 'uppercase' }}>{order.paymentMethod || '—'}</span>
                  </div>
                </div>

                {/* Discounts, fees and tip, as the server priced them (signed pence) */}
                {(order.priceLines || []).length > 0 ? (
                  <div style={{ marginTop: 'var(--space-3)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-2)' }}>
                    {order.priceLines.map((line, i) => (
                      <div key={`${line.kind}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', padding: '2px 0' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {line.label || line.code}
                          {line.kind !== 'tip' ? ` · paid by ${line.fundedBy === 'platform' ? 'platform' : 'you'}` : ''}
                        </span>
                        <span style={{ color: line.amount < 0 ? '#059669' : 'var(--text-primary)', fontWeight: 600 }}>
                          {line.amount < 0 ? `-${formatCurrency(-line.amount)}` : formatCurrency(line.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* ── Picking instructions ── */}
              <div className="order-section">
                <div className="order-section-title">Picking</div>
                <div className="order-info-grid">
                  <div className="order-info-item">
                    <label>Handover</label>
                    <span>{order.fulfilment?.method === 'collection' ? 'Customer collects' : 'Delivery'}</span>
                  </div>
                  <div className="order-info-item">
                    <label>When</label>
                    <span>{formatSlot(order.fulfilment)}</span>
                  </div>
                  <div className="order-info-item">
                    <label>Substitutions</label>
                    <span>{order.allowSubstitutions === false ? 'Not allowed' : 'Allowed'}</span>
                  </div>
                  <div className="order-info-item">
                    <label>Tip</label>
                    <span>{order.tipAmount ? formatCurrency(order.tipAmount) : '—'}</span>
                  </div>
                </div>
                {order.fulfilment?.method !== 'collection' ? (
                  <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                    <label className="form-label">Rider</label>
                    <select
                      className="form-select"
                      value={order.delivery?.rider || ''}
                      disabled={!['pending', 'confirmed', 'packed'].includes(order.orderStatus)}
                      onChange={(e) => assign(e.target.value)}
                    >
                      <option value="">No rider (deliver yourself or by courier)</option>
                      {riders.filter((r) => r.status === 'active' || r._id === order.delivery?.rider).map((r) => (
                        <option key={r._id} value={r._id}>{r.name}</option>
                      ))}
                    </select>
                    {order.delivery?.lastLocation?.at && order.orderStatus === 'shipped' ? (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 4 }}>
                        Last seen {formatDateTime(order.delivery.lastLocation.at)} ·{' '}
                        <a href={`https://www.google.com/maps/search/?api=1&query=${order.delivery.lastLocation.lat},${order.delivery.lastLocation.lng}`} target="_blank" rel="noreferrer">map</a>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {order.ageCheck > 0 && !['delivered', 'collected', 'cancelled'].includes(order.orderStatus) ? (
                  <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                    <label className="form-label" style={{ color: '#b91c1c' }}>Photo ID checked on handover ({order.ageCheck}+)</label>
                    <select className="form-select" value={idType} onChange={(e) => setIdType(e.target.value)}>
                      <option value="">Not checked yet</option>
                      <option value="passport">Passport</option>
                      <option value="driving_licence">Driving licence</option>
                      <option value="pass_card">PASS card</option>
                      <option value="other_photo_id">Other photo ID</option>
                    </select>
                  </div>
                ) : null}
                {order.delivery?.proof?.recipientName || order.delivery?.proof?.photoUrl ? (
                  <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                    Handed to <strong>{order.delivery.proof.recipientName || 'customer'}</strong>
                    {order.delivery.proof.ageVerified ? ` · ID: ${order.delivery.proof.idType.replace('_', ' ')}` : ''}
                    {order.delivery.proof.photoUrl ? (
                      <div><a href={order.delivery.proof.photoUrl} target="_blank" rel="noreferrer">Doorstep photo</a></div>
                    ) : null}
                  </div>
                ) : null}
                {(order.refunds || []).length > 0 ? (
                  <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                    {order.refunds.map((r) => (
                      <div key={r._id} style={{ color: r.status === 'failed' ? '#b91c1c' : 'var(--text-secondary)' }}>
                        {formatCurrency(r.amount)} {r.provider === 'cod' ? 'off the cash due' : r.status === 'failed' ? 'refund FAILED, do it by hand' : 'refunded to card'} · {r.reason}
                      </div>
                    ))}
                  </div>
                ) : null}
                {order.fulfilment?.arrivedAt && !['collected', 'cancelled'].includes(order.orderStatus) ? (
                  <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: '#fef3c7', color: '#92400e', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    Customer is outside (since {formatDateTime(order.fulfilment.arrivedAt)})
                    {order.fulfilment.arrivalNote ? ` — ${order.fulfilment.arrivalNote}` : ''}
                  </div>
                ) : null}
                {order.customerNote ? (
                  <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-50)', fontSize: 'var(--text-sm)' }}>
                    <strong>Customer note:</strong> {order.customerNote}
                  </div>
                ) : null}
              </div>

              {/* ── Customer Info ── */}
              <div className="order-section">
                <div className="order-section-title"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Customer</div>
                <div className="order-info-grid">
                  <div className="order-info-item">
                    <label>Name</label>
                    <span>{order.customerSnapshot?.name || order.customer?.name || '—'}</span>
                  </div>
                  <div className="order-info-item">
                    <label>Email</label>
                    <span>{order.customerSnapshot?.email || order.customer?.email || '—'}</span>
                  </div>
                  <div className="order-info-item">
                    <label>Phone</label>
                    <span>{order.customerSnapshot?.phone || '—'}</span>
                  </div>
                </div>
              </div>

              {/* ── Shipping / Address ── */}
              {order.shippingAddress && (
                <div className="order-section">
                  <div className="order-section-title"><MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />Shipping Address</div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)', lineHeight: 1.5 }}>
                    {[
                      order.shippingAddress.line1,
                      order.shippingAddress.line2,
                      order.shippingAddress.city,
                      order.shippingAddress.county,
                      order.shippingAddress.postcode,
                      order.shippingAddress.country,
                    ].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}

              {/* ── Tracking ── */}
              {order.tracking && (order.tracking.carrier || order.tracking.trackingNumber) && (
                <div className="order-section">
                  <div className="order-section-title"><Truck size={12} style={{ display: 'inline', marginRight: 4 }} />Tracking</div>
                  <div className="order-info-grid">
                    {order.tracking.carrier && (
                      <div className="order-info-item">
                        <label>Carrier</label>
                        <span>{order.tracking.carrier}</span>
                      </div>
                    )}
                    {order.tracking.trackingNumber && (
                      <div className="order-info-item">
                        <label>Tracking Number</label>
                        <span>{order.tracking.trackingNumber}</span>
                      </div>
                    )}
                    {order.tracking.trackingUrl && (
                      <div className="order-info-item" style={{ gridColumn: '1 / -1' }}>
                        <label>Tracking URL</label>
                        <a href={order.tracking.trackingUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 'var(--text-sm)', color: 'var(--aa-link)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {order.tracking.trackingUrl} <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {itemEdit ? (
                <div className="order-section" style={{ background: '#fffbeb', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                  <div className="order-section-title">
                    {itemEdit.action === 'unavailable' ? 'Mark unavailable' : 'Swap for'}: {order.items[itemEdit.index]?.title}
                  </div>
                  {itemEdit.action === 'unavailable' ? (
                    <div className="form-group">
                      <label className="form-label">How many can't you supply?</label>
                      <input type="number" className="form-input" min="1" max={order.items[itemEdit.index]?.quantity} value={itemEdit.quantity} onChange={(e) => setItemEdit({ ...itemEdit, quantity: e.target.value })} />
                    </div>
                  ) : (
                    <>
                      <select className="form-select" value={itemEdit.productId} onChange={(e) => setItemEdit({ ...itemEdit, productId: e.target.value, variantId: '' })}>
                        <option value="">Choose a product</option>
                        {products.filter((p) => p.isActive !== false).map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                      </select>
                      {(products.find((p) => p._id === itemEdit.productId)?.variants || []).length > 0 ? (
                        <select className="form-select" style={{ marginTop: 'var(--space-2)' }} value={itemEdit.variantId} onChange={(e) => setItemEdit({ ...itemEdit, variantId: e.target.value })}>
                          <option value="">Choose a size</option>
                          {products.find((p) => p._id === itemEdit.productId).variants.map((v) => (
                            <option key={v._id} value={v._id}>{Object.values(v.attributes || {}).join(' / ') || v.sku} · {formatCurrency(v.price)}</option>
                          ))}
                        </select>
                      ) : null}
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 4 }}>The customer never pays more than the original price; a cheaper swap is refunded.</p>
                    </>
                  )}
                  <div className="flex justify-end" style={{ gap: '0.5rem', marginTop: 'var(--space-2)' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => setItemEdit(null)}>Cancel</button>
                    <button className="btn btn-sm btn-primary" onClick={saveItemEdit} disabled={itemEdit.action === 'substitute' && !itemEdit.productId}>Save and refund</button>
                  </div>
                </div>
              ) : null}

              {/* ── Order Items ── */}
              <div className="order-section">
                <div className="order-section-title"><Package size={12} style={{ display: 'inline', marginRight: 4 }} />Items ({order.items?.length || 0})</div>
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((item, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                              background: 'var(--gray-100)', overflow: 'hidden',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              {item.product?.images?.[0] ? (
                                <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Package size={14} color="var(--gray-400)" />
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', textDecoration: ['unavailable', 'refused'].includes(item.lineStatus) ? 'line-through' : 'none' }}>
                                {item.product?.title || item.title || 'Product'}
                                {item.minAge ? <span style={{ marginLeft: 6, color: '#b91c1c', fontWeight: 700 }}>{item.minAge}+</span> : null}
                              </div>
                              {item.lineStatus && item.lineStatus !== 'ok' ? (
                                <div style={{ fontSize: 'var(--text-xs)', color: '#b45309' }}>
                                  {item.lineStatus === 'substituted' ? `Substitute for ${item.substitutedFor}` : item.lineStatus === 'refused' ? 'Refused at handover (no ID)' : 'Unavailable, refunded'}
                                </div>
                              ) : item.originalQuantity && item.originalQuantity > item.quantity ? (
                                <div style={{ fontSize: 'var(--text-xs)', color: '#b45309' }}>{item.originalQuantity - item.quantity} of {item.originalQuantity} unavailable, refunded</div>
                              ) : null}
                              {item.variantSnapshot?.attributes?.description && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                                  {item.variantSnapshot.attributes.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice || item.price || 0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          {formatCurrency((item.unitPrice || item.price || 0) * (item.quantity || 1))}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {['ok', 'substituted'].includes(item.lineStatus || 'ok') && ['pending', 'confirmed', 'packed', 'ready_for_collection'].includes(order.orderStatus) ? (
                            <>
                              <button className="btn btn-sm btn-ghost" onClick={() => openItemEdit(i, 'unavailable')}>Unavailable</button>
                              {order.allowSubstitutions !== false && ['pending', 'confirmed', 'packed'].includes(order.orderStatus) ? (
                                <button className="btn btn-sm btn-ghost" onClick={() => openItemEdit(i, 'substitute')}>Swap</button>
                              ) : null}
                            </>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Status Update Controls ── */}
              {nextStatuses.length > 0 && (
                <div className="order-section">
                  <div className="order-section-title">
                    <ArrowRight size={12} style={{ display: 'inline', marginRight: 4 }} />Update Status
                  </div>
                  <div className="status-action-panel">
                    {/* Show shipping fields when "shipped" is an option */}
                    {/* {nextStatuses.includes('shipped') && (
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <h4 style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                          Shipping Details (optional)
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                          <input className="form-input" placeholder="Carrier" value={trackingCarrier}
                            onChange={e => setTrackingCarrier(e.target.value)} style={{ fontSize: 'var(--text-sm)', height: 32 }} />
                          <input className="form-input" placeholder="Tracking Number" value={trackingNumber}
                            onChange={e => setTrackingNumber(e.target.value)} style={{ fontSize: 'var(--text-sm)', height: 32 }} />
                        </div>
                        <input className="form-input" placeholder="Tracking URL" value={trackingUrl}
                          onChange={e => setTrackingUrl(e.target.value)}
                          style={{ fontSize: 'var(--text-sm)', height: 32, marginTop: 'var(--space-2)' }} />
                      </div>
                    )} */}

                    {/* Cancellation reason */}
                    {/* {nextStatuses.includes('cancelled') && (
                      <div style={{ marginBottom: 'var(--space-3)' }}>
                        <textarea className="form-input" placeholder="Cancellation reason (optional)"
                          value={cancellationReason} onChange={e => setCancellationReason(e.target.value)}
                          rows={2} style={{ fontSize: 'var(--text-sm)' }} />
                      </div>
                    )} */}

                    {/* Note */}
                    {/* <textarea className="form-input" placeholder="Note (optional)" value={note}
                      onChange={e => setNote(e.target.value)} rows={2}
                      style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }} /> */}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      {nextStatuses.map(ns => {
                        const btnCfg = STATUS_BUTTON_STYLES[ns] || { className: 'btn btn-ghost', label: ns };
                        const Icon = btnCfg.icon;
                        return (
                          <button key={ns} className={btnCfg.className} disabled={updating}
                            onClick={() => handleStatusUpdate(ns)}
                            style={{ fontSize: 'var(--text-sm)' }}>
                            {Icon && <Icon size={14} />}
                            {updating ? 'Updating…' : btnCfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Status History Timeline ── */}
              <div className="order-section">
                <div className="order-section-title"><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Status History</div>
                {history.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>No status history recorded yet.</p>
                ) : (
                  <div className="order-timeline">
                    {[...history].reverse().map((entry, i) => (
                      <div className="timeline-item" key={i}>
                        <div className={`timeline-dot ${entry.status === 'cancelled' ? 'cancelled' : 'active'}`} />
                        <div className="timeline-title">{entry.status}</div>
                        <div className="timeline-meta">
                          {formatDateTime(entry.changedAt)}
                          {entry.changedBy && (
                            <> · {entry.changedBy.name || entry.changedBy.email || entry.changedByRole || 'System'}</>
                          )}
                        </div>
                        {entry.note && <div className="timeline-note">{entry.note}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
              <div className="empty-state-icon"><Package size={24} /></div>
              <h3>Order not found</h3>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
