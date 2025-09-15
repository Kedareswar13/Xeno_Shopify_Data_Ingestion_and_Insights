import { z } from 'zod';

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(100, 'Email must be less than 100 characters');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  )
  .max(50, 'Password must be less than 50 characters');

export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters');

export const phoneSchema = z
  .string()
  .regex(
    /^\+?[1-9]\d{1,14}$/,
    'Please enter a valid phone number with country code'
  );

export const urlSchema = z
  .string()
  .url('Please enter a valid URL')
  .max(500, 'URL must be less than 500 characters');

export const otpSchema = z
  .string()
  .length(6, 'OTP must be 6 digits')
  .regex(/^\d+$/, 'OTP must contain only numbers');

export const priceSchema = z
  .number()
  .min(0, 'Price cannot be negative')
  .max(1000000, 'Price is too high');

export const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(0, 'Quantity cannot be negative')
  .max(10000, 'Quantity is too high');

export const dateSchema = z.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
}, z.date());

export const colorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color code');

// Auth Schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms and conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
    token: z.string().min(1, 'Token is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Profile Schemas
export const updateProfileSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  avatar: z.string().optional(),
});

// Store Schemas
export const createStoreSchema = z.object({
  name: z.string().min(2, 'Store name must be at least 2 characters').max(100),
  domain: z.string().min(3, 'Store domain must be at least 3 characters'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  timezone: z.string().min(1, 'Timezone is required'),
});

export const updateStoreSchema = createStoreSchema.partial();

// Product Schemas
export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name is required').max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0, 'Price cannot be negative'),
  compareAtPrice: z.number().min(0, 'Price cannot be negative').optional(),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  weight: z.number().min(0, 'Weight cannot be negative').optional(),
  weightUnit: z.string().optional(),
  status: z.enum(['active', 'draft', 'archived']),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateProductSchema = createProductSchema.partial();

// Collection Schemas
export const createCollectionSchema = z.object({
  title: z.string().min(2, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  image: z.string().optional(),
  status: z.enum(['active', 'draft', 'archived']),
  products: z.array(z.string()).optional(),
});

export const updateCollectionSchema = createCollectionSchema.partial();

// Order Schemas
export const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  status: z.enum([
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ]),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product is required'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      price: z.number().min(0, 'Price cannot be negative'),
    })
  ),
  shippingAddress: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    address1: z.string().min(1, 'Address is required'),
    address2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required'),
    phone: phoneSchema.optional(),
  }),
  billingAddress: z
    .object({
      firstName: z.string().min(1, 'First name is required'),
      lastName: z.string().min(1, 'Last name is required'),
      address1: z.string().min(1, 'Address is required'),
      address2: z.string().optional(),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      postalCode: z.string().min(1, 'Postal code is required'),
      country: z.string().min(1, 'Country is required'),
      phone: phoneSchema.optional(),
    })
    .optional(),
  sameAsBilling: z.boolean().optional(),
  shippingMethod: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ]),
  notifyCustomer: z.boolean().optional(),
});

// Customer Schemas
export const createCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: emailSchema,
  phone: phoneSchema.optional(),
  acceptsMarketing: z.boolean().optional(),
  addresses: z
    .array(
      z.object({
        address1: z.string().min(1, 'Address is required'),
        address2: z.string().optional(),
        city: z.string().min(1, 'City is required'),
        state: z.string().min(1, 'State is required'),
        postalCode: z.string().min(1, 'Postal code is required'),
        country: z.string().min(1, 'Country is required'),
        phone: phoneSchema.optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// Discount Schemas
export const createDiscountSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(50),
  type: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
  value: z.number().min(0, 'Value cannot be negative'),
  minPurchaseAmount: z.number().min(0, 'Amount cannot be negative').optional(),
  maxUses: z.number().int().min(1, 'Must be at least 1').optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
  appliesTo: z
    .object({
      collectionIds: z.array(z.string()).optional(),
      productIds: z.array(z.string()).optional(),
    })
    .optional(),
  customerEligibility: z
    .object({
      customerIds: z.array(z.string()).optional(),
      minOrderCount: z.number().int().min(0).optional(),
      minTotalSpent: z.number().min(0).optional(),
    })
    .optional(),
});

export const updateDiscountSchema = createDiscountSchema.partial();

// Export all schemas
export const schemas = {
  auth: {
    login: loginSchema,
    register: registerSchema,
    verifyOtp: verifyOtpSchema,
    forgotPassword: forgotPasswordSchema,
    resetPassword: resetPasswordSchema,
  },
  profile: {
    update: updateProfileSchema,
  },
  store: {
    create: createStoreSchema,
    update: updateStoreSchema,
  },
  product: {
    create: createProductSchema,
    update: updateProductSchema,
  },
  collection: {
    create: createCollectionSchema,
    update: updateCollectionSchema,
  },
  order: {
    create: createOrderSchema,
    updateStatus: updateOrderStatusSchema,
  },
  customer: {
    create: createCustomerSchema,
    update: updateCustomerSchema,
  },
  discount: {
    create: createDiscountSchema,
    update: updateDiscountSchema,
  },
  common: {
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
    phone: phoneSchema,
    url: urlSchema,
    otp: otpSchema,
    price: priceSchema,
    quantity: quantitySchema,
    date: dateSchema,
    color: colorSchema,
  },
} as const;
