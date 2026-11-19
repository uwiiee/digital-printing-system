// The short code people see for an order, e.g. "K7P3XQ". Older orders have no code, so use the end of the id.
export const orderLabel = (order) => order.code || order._id.slice(-6).toUpperCase();
