// Single source of truth for navigation, product and company facts.
// Used by the header, footer and the new pages.

export const company = {
  name: 'PPD Technology',
  legal: 'PPD Technology, LLC',
  salesPhone: '(248) 726-0085',
  salesTel: '2487260085',
  supportPhone: '(313) 466-7836',
  supportTel: '3134667836',
  email: 'info@ppdtechnology.com',
  hours: 'Mon–Thu 8a–8p · Fri 8a–6p · Sat 9a–2p ET',
  isoLine:
    'PPD Technology, LLC is a Registered ISO of Pinnacle Bank, a Tennessee Bank, dba Synovus Bank',
  agentCalendar:
    'https://calendar.google.com/calendar/appointments/schedules/AcZssZ34gwW6Fs4yYTWT4Y5PwFVZ9BDuuR_F9sdeCnIx3YhHz_pNa9FnkX-zimGF1LU92MD149NRVVMo?gv=true',
};

export type ProductKey = 'forge' | 'repair' | 'merchant' | 'rewards';

export interface Product {
  key: ProductKey;
  name: string;
  short: string;
  kind: string;
  tagline: string;
  blurb: string;
  href: string;
  site: string;
  siteLabel: string;
  login: string;
  icon: string;
  logoDark: string; // for dark backgrounds
  logoLight?: string;
  price: string;
  priceNote: string;
  audience: string;
}

export const products: Product[] = [
  {
    key: 'forge',
    name: 'Forge POS',
    short: 'Forge',
    kind: 'Point of sale',
    tagline: 'Built to move the line.',
    blurb:
      'The register for busy retail counters. Cash and card prices side by side, EBT, bottle deposits and a customer-facing screen, with Forge Cloud running the back office.',
    href: '/forge',
    site: 'https://ppdforge.com',
    siteLabel: 'ppdforge.com',
    login: 'https://cloud.ppdforge.com/login',
    icon: '/images/brand/forge-icon.webp',
    logoDark: '/images/brand/forge-wordmark-dark.webp',
    logoLight: '/images/brand/forge-wordmark-light.webp',
    price: 'Quoted per counter',
    priceNote: 'Hardware and setup confirmed with PPD',
    audience: 'Convenience, grocery, delis, bakeries, dollar and gift stores',
  },
  {
    key: 'repair',
    name: 'PPD Repair',
    short: 'Repair',
    kind: 'Repair shop software',
    tagline: 'Run every repair from one command board.',
    blurb:
      'Tickets, point of sale, serialized inventory, payments and customer updates on one screen, from intake to pickup to the Google review.',
    href: '/repair',
    site: 'https://www.ppdrepair.com',
    siteLabel: 'ppdrepair.com',
    login: 'https://www.ppdrepair.com/login',
    icon: '/images/brand/repair-icon.webp',
    logoDark: '/images/brand/repair-logo.webp',
    price: '$30 / month',
    priceNote: 'Per location, full platform included',
    audience: 'Phone, computer, jewelry, watch, camera and small-engine repair',
  },
  {
    key: 'merchant',
    name: 'PPD Merchant',
    short: 'Merchant',
    kind: 'Payments workspace',
    tagline: 'Every payment. The whole picture.',
    blurb:
      'Virtual terminal, invoices, payment links, ACH, orders, customers and agreements in one connected workspace for B2B and service businesses.',
    href: '/merchant',
    site: 'https://ppdmerchant.com',
    siteLabel: 'ppdmerchant.com',
    login: 'https://ppdmerchant.com/login',
    icon: '/images/brand/merchant-icon.webp',
    logoDark: '/images/brand/merchant-logo-light.webp',
    logoLight: '/images/brand/merchant-logo.webp',
    price: 'Free',
    priceNote: 'Core portal, no monthly software fee',
    audience: 'Wholesalers, service businesses, contractors, equipment dealers',
  },
  {
    key: 'rewards',
    name: 'PPD Rewards',
    short: 'Rewards',
    kind: 'Merchant rewards',
    tagline: 'Rewards on every eligible dollar you process.',
    blurb:
      'Enrolled merchants turn processing volume into statement credits and digital gift cards, tracked by location with one combined balance.',
    href: '/products/ppd-rewards',
    site: 'https://www.ppdrewards.com',
    siteLabel: 'ppdrewards.com',
    login: 'https://ppdrewards.com/login',
    icon: '/images/brand/rewards-logo.webp',
    logoDark: '/images/brand/rewards-logo.webp',
    price: 'Included',
    priceNote: 'For enrolled PPD merchants in good standing',
    audience: 'Existing PPD processing merchants, single or multi-location',
  },
];

export const product = (key: ProductKey) => products.find((p) => p.key === key)!;

export const lineup = [
  { name: 'KORONA POS', note: 'Cloud retail POS · authorized reseller', href: '/korona' },
  { name: 'Clover', note: 'Station Duo, Solo, Mini and Flex', href: '/clover' },
  { name: 'Valor VP800', note: 'Dual-screen countertop terminal', href: '/vp-800' },
  { name: 'Pays POS', note: 'Restaurant POS, KDS and kiosks', href: '/pays-pos' },
  { name: 'MX-Build', note: 'Estimating, scheduling and billing for contractors', href: '/mx-build' },
  { name: 'Passport Banking', note: 'Embedded accounts and treasury', href: '/passport-banking' },
];

export const industries = [
  { name: 'Restaurants', href: '/restaurants', note: 'Online ordering, QR pay, kitchen display' },
  { name: 'Retail', href: '/retail', note: 'Checkout, inventory, dual pricing' },
  { name: 'Repair shops', href: '/repair', note: 'Tickets, parts, deposits, pickups' },
  { name: 'B2B & services', href: '/merchant', note: 'Invoices, ACH, recurring billing' },
  { name: 'E-commerce', href: '/ecommerce', note: 'Checkout, subscriptions, tokenization' },
  { name: 'Contractors', href: '/contractors', note: 'Estimates, deposits, progress billing' },
  { name: 'Healthcare', href: '/healthcare', note: 'Patient payments at the desk and online' },
  { name: 'Non-profits', href: '/non-profits', note: 'Donations, recurring gifts, events' },
  { name: 'Higher education', href: '/higher-education', note: 'Tuition, fees and campus commerce' },
];

export const partnerLinks = [
  { name: 'Agent program', href: '/agents', note: 'Keep your book. Sell software with your brand on it.' },
  { name: 'ISO solutions', href: '/iso', note: 'Proprietary software and CRM for your ISO.' },
  { name: 'ISV solutions', href: '/isv-solutions', note: 'Embed payments, or have the platform built.' },
  { name: 'Refer a merchant', href: '/refer', note: '$200 per approved signup.' },
];

export const logins = [
  { name: 'PPD Portal', href: 'https://ppdportal.com/login' },
  { name: 'PPD Merchant', href: 'https://ppdmerchant.com/login' },
  { name: 'PPD Repair', href: 'https://www.ppdrepair.com/login' },
  { name: 'PPD Forge', href: 'https://cloud.ppdforge.com/login' },
  { name: 'PPD Rewards', href: 'https://ppdrewards.com/login' },
  { name: 'MX Merchant', href: 'https://app.mxmerchant.com/' },
  { name: 'Passport Banking', href: 'https://customer.prioritypassport.com/' },
  { name: 'Payroll', href: 'https://payroll.prioritycommerce.com/' },
  { name: 'PPD NMI', href: 'https://ppdtechnology.transactiongateway.com/merchants/login.php' },
  { name: 'iPOSpays', href: 'https://portal.ipospays.com/auth/login?returnUrl=%2Fdashboardv2' },
];
