import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

/**
 * Serves a self-contained HTML page that opens Razorpay checkout.
 * No JWT guard — access is gated by the short-lived Razorpay order ID
 * that the mobile client obtained from the authenticated `POST /tenant/pay/create-order`.
 *
 * On payment success  → redirects to `{callbackScheme}://pay-success?orderId=...&paymentId=...&signature=...&rentCycleId=...`
 * On dismiss / cancel → redirects to `{callbackScheme}://pay-cancel`
 *
 * The mobile app catches these deep-link callbacks via `expo-web-browser`'s
 * `openAuthSessionAsync`, then calls `POST /tenant/pay/verify` to record the payment.
 */
@ApiExcludeController()
@Controller('tenant/pay')
export class PaymentCheckoutController {
  @Get('checkout')
  checkout(
    @Query('orderId') orderId = '',
    @Query('keyId') keyId = '',
    @Query('amount') amount = '0',
    @Query('currency') currency = 'INR',
    @Query('name') name = '',
    @Query('email') email = '',
    @Query('phone') phone = '',
    @Query('rentCycleId') rentCycleId = '',
    @Query('callbackScheme') callbackScheme = 'pgmanager',
    @Res() res: FastifyReply,
  ) {
    // Escape values before embedding in a JS string literal.
    // We never output these into raw HTML, only into quoted JS strings.
    const esc = (s: string) =>
      String(s ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' ')
        .slice(0, 512);

    const amountPaise = Math.max(0, parseInt(amount, 10) || 0);
    const displayAmount = (amountPaise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PG Manager — Pay Now</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #ffffff;
      border-radius: 24px;
      padding: 44px 36px;
      text-align: center;
      max-width: 400px;
      width: 92%;
      box-shadow: 0 12px 40px rgba(79, 70, 229, 0.14);
    }
    .logo { font-size: 36px; margin-bottom: 8px; }
    .brand { font-size: 20px; font-weight: 700; color: #4f46e5; margin-bottom: 4px; }
    .tagline { font-size: 13px; color: #9ca3af; margin-bottom: 28px; letter-spacing: 0.3px; }
    .amount-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px; }
    .amount { font-size: 48px; font-weight: 800; color: #111827; margin-bottom: 32px; letter-spacing: -1px; }
    .amount span { font-size: 28px; }
    .spinner-wrap { margin-bottom: 14px; }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid #e5e7eb;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .msg { font-size: 14px; color: #6b7280; line-height: 1.5; }
    .retry-btn {
      display: none;
      margin-top: 20px;
      background: #4f46e5;
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 14px 32px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background 0.2s;
    }
    .retry-btn:hover { background: #4338ca; }
    .secure-note {
      margin-top: 28px;
      font-size: 11px;
      color: #d1d5db;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🏠</div>
    <div class="brand">PG Manager</div>
    <div class="tagline">Secure Rent Payment</div>
    <div class="amount-label">Amount Due</div>
    <div class="amount"><span>₹</span>${displayAmount}</div>
    <div class="spinner-wrap"><div class="spinner" id="spinner"></div></div>
    <div class="msg" id="msg">Opening secure payment gateway…</div>
    <button class="retry-btn" id="retryBtn" onclick="openRzp()">↩ Retry Payment</button>
    <div class="secure-note">🔒 Secured by Razorpay</div>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var RZP_KEY   = '${esc(keyId)}';
    var ORDER_ID  = '${esc(orderId)}';
    var AMOUNT    = ${amountPaise};
    var CURRENCY  = '${esc(currency)}';
    var TNAME     = '${esc(name)}';
    var TEMAIL    = '${esc(email)}';
    var TPHONE    = '${esc(phone)}';
    var CYCLE_ID  = '${esc(rentCycleId)}';
    var SCHEME    = '${esc(callbackScheme)}';

    function setMsg(text, showRetry) {
      document.getElementById('spinner').style.display = showRetry ? 'none' : 'block';
      document.getElementById('msg').textContent = text;
      document.getElementById('retryBtn').style.display = showRetry ? 'block' : 'none';
    }

    function openRzp() {
      setMsg('Opening secure payment gateway…', false);

      if (typeof Razorpay === 'undefined') {
        setMsg('Payment gateway failed to load. Please check your internet connection.', true);
        return;
      }

      var options = {
        key:         RZP_KEY,
        order_id:    ORDER_ID,
        amount:      AMOUNT,
        currency:    CURRENCY,
        name:        'PG Manager',
        description: 'Rent Payment',
        prefill: {
          name:    TNAME,
          email:   TEMAIL,
          contact: TPHONE,
        },
        theme: { color: '#4f46e5' },
        handler: function (response) {
          setMsg('Payment verified! Redirecting…', false);
          var url = SCHEME + '://pay-success'
            + '?orderId='    + encodeURIComponent(response.razorpay_order_id)
            + '&paymentId='  + encodeURIComponent(response.razorpay_payment_id)
            + '&signature='  + encodeURIComponent(response.razorpay_signature)
            + '&rentCycleId='+ encodeURIComponent(CYCLE_ID);
          window.location.href = url;
        },
        modal: {
          ondismiss: function () {
            window.location.href = SCHEME + '://pay-cancel';
          },
        },
      };

      try {
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
          setMsg('Payment failed: ' + (response.error && response.error.description ? response.error.description : 'Unknown error'), true);
        });
        rzp.open();
      } catch (e) {
        setMsg('Could not open payment gateway. Please try again.', true);
      }
    }

    // Auto-open after a short delay to let the page render
    window.addEventListener('load', function () {
      setTimeout(openRzp, 600);
    });
  </script>
</body>
</html>`;

    res
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .send(html);
  }
}
