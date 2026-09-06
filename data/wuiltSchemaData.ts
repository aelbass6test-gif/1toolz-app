export interface WuiltOperation {
  name: string;
  type: 'Query' | 'Mutation';
  description: string;
  category: 'Orders' | 'Products' | 'Cart & Checkout' | 'Customers' | 'Shipping' | 'Collections' | 'Admin & Analytics';
  graphql: string;
  variables?: string;
  responseExample: string;
}

export interface WuiltSampleApi {
  id: string;
  name: string;
  arabicTitle: string;
  description: string;
  type: 'Query' | 'Mutation';
  category: 'Cart & Checkout' | 'Products & Collections' | 'Orders & Customers';
  query: string;
  variables: string;
  response: string;
}

export const WUILT_MUTATIONS: WuiltOperation[] = [
  {
    name: 'addProductsToCollection',
    type: 'Mutation',
    description: 'إضافة مجموعة منتجات إلى تصنيف أو كولكشن محدد داخل المتجر.',
    category: 'Collections',
    graphql: `mutation AddProductsToCollection($input: CollectionInput!) {
  addProductsToCollection(input: $input) {
    collection {
      id
      title
      productsCount
    }
  }
}`,
    variables: `{\n  "input": {\n    "collectionId": "col_123456",\n    "productIds": ["prod_987", "prod_988"]\n  }\n}`,
    responseExample: `{\n  "data": {\n    "addProductsToCollection": {\n      "collection": {\n        "id": "col_123456",\n        "title": "العروض الصيفية",\n        "productsCount": 15\n      }\n    }\n  }\n}`
  },
  {
    name: 'addTagsToOrder',
    type: 'Mutation',
    description: 'إضافة وسوم وعلامات تصنيف (Tags) لطلب محدد لسهولة الفلترة وإدارة العمليات.',
    category: 'Orders',
    graphql: `mutation AddTagsToOrder($orderId: ID!, $tags: [String!]!) {
  addTagsToOrder(orderId: $orderId, tags: $tags) {
    id
    orderNumber
    tags {
      id
      name
    }
  }
}`,
    variables: `{\n  "orderId": "ord_88291",\n  "tags": ["واتساب-مؤكد", "شحن-سريع"]\n}`,
    responseExample: `{\n  "data": {\n    "addTagsToOrder": {\n      "id": "ord_88291",\n      "orderNumber": "10452",\n      "tags": [\n        { "id": "tag_1", "name": "واتساب-مؤكد" },\n        { "id": "tag_2", "name": "شحن-سريع" }\n      ]\n    }\n  }\n}`
  },
  {
    name: 'addTagsToOrders',
    type: 'Mutation',
    description: 'إضافة وسوم مجمعة لعدة طلبات دفعة واحدة (Bulk Action).',
    category: 'Orders',
    graphql: `mutation AddTagsToOrders($orderIds: [ID!]!, $tags: [String!]!) {
  addTagsToOrders(orderIds: $orderIds, tags: $tags) {
    success
    affectedOrdersCount
  }
}`,
    variables: `{\n  "orderIds": ["ord_1", "ord_2", "ord_3"],\n  "tags": ["تصدير-بوليصة"]\n}`,
    responseExample: `{\n  "data": {\n    "addTagsToOrders": {\n      "success": true,\n      "affectedOrdersCount": 3\n    }\n  }\n}`
  },
  {
    name: 'adminActions',
    type: 'Mutation',
    description: 'تنفيذ عمليات وإجراءات إدارية متقدمة على مستوى إدارة المتجر.',
    category: 'Admin & Analytics',
    graphql: `mutation AdminActions($action: AdminActionInput!) {
  adminActions(input: $action) {
    status
    message
  }
}`,
    variables: `{\n  "action": {\n    "type": "REFRESH_STORE_CACHE"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "adminActions": {\n      "status": "SUCCESS",\n      "message": "تم تحديث ذاكرة المتجر بنجاح"\n    }\n  }\n}`
  },
  {
    name: 'createCollection',
    type: 'Mutation',
    description: 'إنشاء تصنيف أو مجموعة منتجات جديدة مع تفاصيل SEO والترجمة.',
    category: 'Collections',
    graphql: `mutation CreateCollection($input: CollectionInput!) {
  createCollection(input: $input) {
    collection {
      id
      title
      handle
      productsCount
    }
  }
}`,
    variables: `{\n  "input": {\n    "title": "الملابس الرجالية",\n    "handle": "men-fashion",\n    "description": "أحدث صيحات الموضة للرجال"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "createCollection": {\n      "collection": {\n        "id": "col_7712",\n        "title": "الملابس الرجالية",\n        "handle": "men-fashion",\n        "productsCount": 0\n      }\n    }\n  }\n}`
  },
  {
    name: 'createCustomer',
    type: 'Mutation',
    description: 'تسجيل وإضافة عميل جديد في قاعدة بيانات متجر ويلت.',
    category: 'Customers',
    graphql: `mutation CreateCustomer($input: customerUserInput!) {
  createCustomer(input: $input) {
    customer {
      id
      firstName
      lastName
      email
      phone
    }
  }
}`,
    variables: `{\n  "input": {\n    "firstName": "أحمد",\n    "lastName": "علي",\n    "phone": "+201012345678",\n    "email": "ahmed@example.com"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "createCustomer": {\n      "customer": {\n        "id": "cust_9921",\n        "firstName": "أحمد",\n        "lastName": "علي",\n        "email": "ahmed@example.com",\n        "phone": "+201012345678"\n      }\n    }\n  }\n}`
  },
  {
    name: 'createProduct',
    type: 'Mutation',
    description: 'إضافة منتج جديد بكافة الخيارات، الأسعار، المخزون، والصور.',
    category: 'Products',
    graphql: `mutation CreateProduct($input: ProductInput!) {
  createProduct(input: $input) {
    product {
      id
      title
      price
      compareAtPrice
      quantity
      status
    }
  }
}`,
    variables: `{\n  "input": {\n    "title": "سماعة بلوتوث رياضية عازلة للضوضاء",\n    "price": 450,\n    "compareAtPrice": 600,\n    "quantity": 50,\n    "status": "ACTIVE"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "createProduct": {\n      "product": {\n        "id": "prod_5510",\n        "title": "سماعة بلوتوث رياضية عازلة للضوضاء",\n        "price": 450,\n        "compareAtPrice": 600,\n        "quantity": 50,\n        "status": "ACTIVE"\n      }\n    }\n  }\n}`
  },
  {
    name: 'createProductAttribute',
    type: 'Mutation',
    description: 'إنشاء سمة مخصصة للمنتجات (مثل: المادة، المقاس، بلد المنشأ).',
    category: 'Products',
    graphql: `mutation CreateProductAttribute($input: CreateProductAttributeInput!) {
  createProductAttribute(input: $input) {
    productAttribute {
      id
      name
      type
    }
  }
}`,
    variables: `{\n  "input": {\n    "name": "الخامة",\n    "type": "TEXT"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "createProductAttribute": {\n      "productAttribute": {\n        "id": "attr_101",\n        "name": "الخامة",\n        "type": "TEXT"\n      }\n    }\n  }\n}`
  },
  {
    name: 'createProductAttributeValue',
    type: 'Mutation',
    description: 'إضافة قيمة جديدة لسمة المنتج (مثل: قطن 100% لخامة الملابس).',
    category: 'Products',
    graphql: `mutation CreateProductAttributeValue($input: CreateProductAttributeValueInput!) {
  createProductAttributeValue(input: $input) {
    productAttributeValue {
      id
      value
    }
  }
}`,
    variables: `{\n  "input": {\n    "attributeId": "attr_101",\n    "value": "قطن 100%"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "createProductAttributeValue": {\n      "productAttributeValue": {\n        "id": "val_502",\n        "value": "قطن 100%"\n      }\n    }\n  }\n}`
  },
  {
    name: 'createProductOption',
    type: 'Mutation',
    description: 'إنشاء خيار للمنتج يولد متغيرات (مثل اللون، القياس).',
    category: 'Products',
    graphql: `mutation CreateProductOption($input: ProductOptionInput!) {
  createProductOption(input: $input) {
    productOption {
      id
      name
      values
    }
  }
}`,
    variables: `{\n  "input": {\n    "name": "اللون",\n    "type": "COLOR"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "createProductOption": {\n      "productOption": {\n        "id": "opt_22",\n        "name": "اللون",\n        "values": []\n      }\n    }\n  }\n}`
  },
  {
    name: 'createProductOptionValue',
    type: 'Mutation',
    description: 'إضافة قيمة لخيار المنتج (مثل: أسود، أزرق).',
    category: 'Products',
    graphql: `mutation CreateProductOptionValue($input: ProductOptionValueInput!) {
  createProductOptionValue(input: $input) {
    productOptionValue {
      id
      name
      hexCode
    }
  }
}`,
    variables: `{\n  "input": {\n    "optionId": "opt_22",\n    "name": "أسود ملكي",\n    "hexCode": "#000000"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "createProductOptionValue": {\n      "productOptionValue": {\n        "id": "opt_val_99",\n        "name": "أسود ملكي",\n        "hexCode": "#000000"\n      }\n    }\n  }\n}`
  },
  {
    name: 'markOrderAsPaid',
    type: 'Mutation',
    description: 'تحويل حالة دفع الطلب إلى (مدفوع / Paid) بعد تحصيل المبلغ.',
    category: 'Orders',
    graphql: `mutation MarkOrderAsPaid($input: MarkOrderPaidInput!) {
  markOrderAsPaid(input: $input) {
    order {
      id
      orderNumber
      paymentStatus
      financialStatus
    }
  }
}`,
    variables: `{\n  "input": {\n    "orderId": "ord_88291",\n    "paymentMethod": "COD_SETTLED",\n    "note": "تم التحصيل من المندوب"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "markOrderAsPaid": {\n      "order": {\n        "id": "ord_88291",\n        "orderNumber": "10452",\n        "paymentStatus": "PAID",\n        "financialStatus": "SETTLED"\n      }\n    }\n  }\n}`
  },
  {
    name: 'markOrdersAsCanceled',
    type: 'Mutation',
    description: 'إلغاء مجموعة طلبات وتحديث حالة المخزون وإشعار العملاء.',
    category: 'Orders',
    graphql: `mutation MarkOrdersAsCanceled($orderIds: [ID!]!, $reason: String) {
  markOrdersAsCanceled(orderIds: $orderIds, reason: $reason) {
    success
    canceledCount
  }
}`,
    variables: `{\n  "orderIds": ["ord_12", "ord_15"],\n  "reason": "عدم تأكيد العميل عبر الواتساب"\n}`,
    responseExample: `{\n  "data": {\n    "markOrdersAsCanceled": {\n      "success": true,\n      "canceledCount": 2\n    }\n  }\n}`
  },
  {
    name: 'removeProductsFromCollection',
    type: 'Mutation',
    description: 'إزالة منتجات محددة من تصنيف أو مجموعة معينة.',
    category: 'Collections',
    graphql: `mutation RemoveProductsFromCollection($input: CollectionInput!) {
  removeProductsFromCollection(input: $input) {
    collection {
      id
      productsCount
    }
  }
}`,
    variables: `{\n  "input": {\n    "collectionId": "col_123456",\n    "productIds": ["prod_987"]\n  }\n}`,
    responseExample: `{\n  "data": {\n    "removeProductsFromCollection": {\n      "collection": {\n        "id": "col_123456",\n        "productsCount": 14\n      }\n    }\n  }\n}`
  },
  {
    name: 'updateCustomer',
    type: 'Mutation',
    description: 'تعديل بيانات عميل موجود، عناوينه، أو ملاحظات الحساب.',
    category: 'Customers',
    graphql: `mutation UpdateCustomer($input: updateCustomerUserInput!) {
  updateCustomer(input: $input) {
    customer {
      id
      firstName
      lastName
      phone
      totalSpent
      ordersCount
    }
  }
}`,
    variables: `{\n  "input": {\n    "id": "cust_9921",\n    "phone": "+201099887766"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "updateCustomer": {\n      "customer": {\n        "id": "cust_9921",\n        "firstName": "أحمد",\n        "lastName": "علي",\n        "phone": "+201099887766",\n        "totalSpent": 1850,\n        "ordersCount": 4\n      }\n    }\n  }\n}`
  },
  {
    name: 'updateProduct',
    type: 'Mutation',
    description: 'تحديث بيانات المنتج، الأسعار، المخزون، والوصف.',
    category: 'Products',
    graphql: `mutation UpdateProduct($input: UpdateProductInput!) {
  updateProduct(input: $input) {
    product {
      id
      title
      price
      quantity
      updatedAt
    }
  }
}`,
    variables: `{\n  "input": {\n    "id": "prod_5510",\n    "price": 399,\n    "quantity": 80\n  }\n}`,
    responseExample: `{\n  "data": {\n    "updateProduct": {\n      "product": {\n        "id": "prod_5510",\n        "title": "سماعة بلوتوث رياضية عازلة للضوضاء",\n        "price": 399,\n        "quantity": 80,\n        "updatedAt": "2026-09-05T18:00:00Z"\n      }\n    }\n  }\n}`
  },
  {
    name: 'updateProductVariantImage',
    type: 'Mutation',
    description: 'تعيين وتحديث صورة متغير المنتج (Variant Image).',
    category: 'Products',
    graphql: `mutation UpdateProductVariantImage($input: ProductVariantImageInput!) {
  updateProductVariantImage(input: $input) {
    variant {
      id
      title
      image {
        url
      }
    }
  }
}`,
    variables: `{\n  "input": {\n    "variantId": "var_901",\n    "imageUrl": "https://example.com/black-headphones.jpg"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "updateProductVariantImage": {\n      "variant": {\n        "id": "var_901",\n        "title": "أسود",\n        "image": {\n          "url": "https://example.com/black-headphones.jpg"\n        }\n      }\n    }\n  }\n}`
  },
  {
    name: 'wuiltShipment',
    type: 'Mutation',
    description: 'إنشاء وإصدار بوليصة شحن عبر مزودي الشحن المتكاملين في ويلت (Bosta, Mylerz, Aramex, etc.).',
    category: 'Shipping',
    graphql: `mutation WuiltShipment($input: WuiltShipmentWizardInput!) {
  wuiltShipment(input: $input) {
    shipment {
      id
      awbNumber
      shippingCompany
      status
      trackingUrl
    }
  }
}`,
    variables: `{\n  "input": {\n    "orderId": "ord_88291",\n    "provider": "BOSTA",\n    "pickupAddressId": "addr_loc_1"\n  }\n}`,
    responseExample: `{\n  "data": {\n    "wuiltShipment": {\n      "shipment": {\n        "id": "ship_4410",\n        "awbNumber": "BST-99827110",\n        "shippingCompany": "BOSTA",\n        "status": "PICKUP_REQUESTED",\n        "trackingUrl": "https://bosta.co/tracking/BST-99827110"\n      }\n    }\n  }\n}`
  }
];

export const WUILT_QUERIES: WuiltOperation[] = [
  {
    name: 'orders',
    type: 'Query',
    description: 'استعلام واسترجاع قائمة الطلبات مع الفلترة حسب الحالة، التاريخ، والعميل.',
    category: 'Orders',
    graphql: `query GetOrders($filter: OrdersFilterInput, $first: Int, $after: ConnectionCursor) {
  orders(filter: $filter, first: $first, after: $after) {
    edges {
      node {
        id
        orderNumber
        createdAt
        total
        currency
        status
        paymentStatus
        customer {
          firstName
          lastName
          phone
        }
        items {
          title
          quantity
          price
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
    variables: `{\n  "filter": {\n    "status": "PENDING"\n  },\n  "first": 10\n}`,
    responseExample: `{\n  "data": {\n    "orders": {\n      "edges": [\n        {\n          "node": {\n            "id": "ord_101",\n            "orderNumber": "10452",\n            "createdAt": "2026-09-05T14:30:00Z",\n            "total": 650,\n            "currency": "EGP",\n            "status": "PENDING",\n            "paymentStatus": "COD",\n            "customer": {\n              "firstName": "محمد",\n              "lastName": "السيد",\n              "phone": "+201001234567"\n            },\n            "items": [\n              {\n                "title": "ساعة ذكية مقاومة للماء",\n                "quantity": 1,\n                "price": 650\n              }\n            ]\n          }\n        }\n      ],\n      "pageInfo": {\n        "hasNextPage": false,\n        "endCursor": "cursor_101"\n      }\n    }\n  }\n}`
  },
  {
    name: 'order',
    type: 'Query',
    description: 'استرجاع تفاصيل طلب محدد بالـ ID أو برقم الطلب.',
    category: 'Orders',
    graphql: `query GetOrderDetails($id: ID!) {
  order(id: $id) {
    id
    orderNumber
    createdAt
    status
    paymentStatus
    financialStatus
    total
    subtotal
    shippingCost
    discountTotal
    shippingAddress {
      street
      city
      state
      phone
      notes
    }
    items {
      id
      title
      variantTitle
      quantity
      price
      sku
    }
    tags {
      id
      name
    }
  }
}`,
    variables: `{\n  "id": "ord_101"\n}`,
    responseExample: `{\n  "data": {\n    "order": {\n      "id": "ord_101",\n      "orderNumber": "10452",\n      "createdAt": "2026-09-05T14:30:00Z",\n      "status": "CONFIRMED",\n      "paymentStatus": "UNPAID",\n      "financialStatus": "PENDING",\n      "total": 650,\n      "subtotal": 600,\n      "shippingCost": 50,\n      "discountTotal": 0,\n      "shippingAddress": {\n        "street": "شارع النصر، المعادي",\n        "city": "القاهرة",\n        "state": "القاهرة",\n        "phone": "+201001234567",\n        "notes": "الاتصال قبل الوصول"\n      },\n      "items": [\n        {\n          "id": "item_1",\n          "title": "ساعة ذكية مقاومة للماء",\n          "variantTitle": "أسود",\n          "quantity": 1,\n          "price": 600,\n          "sku": "WATCH-BLK-01"\n        }\n      ],\n      "tags": [\n        { "id": "t1", "name": "واتساب-مؤكد" }\n      ]\n    }\n  }\n}`
  },
  {
    name: 'products',
    type: 'Query',
    description: 'استعلام المنتجات مع دعم البحث النصي والفلترة حسب السعر، الفئات والمخزون.',
    category: 'Products',
    graphql: `query GetProducts($filter: ProductsFilterInput, $first: Int) {
  products(filter: $filter, first: $first) {
    edges {
      node {
        id
        title
        handle
        price
        compareAtPrice
        quantity
        images {
          url
          alt
        }
        variants {
          id
          title
          price
          quantity
        }
      }
    }
  }
}`,
    variables: `{\n  "first": 20\n}`,
    responseExample: `{\n  "data": {\n    "products": {\n      "edges": [\n        {\n          "node": {\n            "id": "prod_5510",\n            "title": "سماعة بلوتوث رياضية",\n            "handle": "wireless-sport-earphones",\n            "price": 450,\n            "compareAtPrice": 600,\n            "quantity": 50,\n            "images": [\n              { "url": "https://cdn.wuilt.com/img1.jpg", "alt": "سماعة" }\n            ],\n            "variants": []\n          }\n        }\n      ]\n    }\n  }\n}`
  },
  {
    name: 'product',
    type: 'Query',
    description: 'استرجاع تفاصيل منتج محدد مع كافة خياراته ومتغيراته وصوره.',
    category: 'Products',
    graphql: `query GetProduct($id: ID!) {
  product(id: $id) {
    id
    title
    description
    price
    compareAtPrice
    quantity
    sku
    status
    options {
      id
      name
      values
    }
    variants {
      id
      title
      price
      quantity
      sku
    }
  }
}`,
    variables: `{\n  "id": "prod_5510"\n}`,
    responseExample: `{\n  "data": {\n    "product": {\n      "id": "prod_5510",\n      "title": "سماعة بلوتوث رياضية",\n      "description": "<p>سماعة لاسلكية عالية الجودة مع بطارية تدوم 24 ساعة</p>",\n      "price": 450,\n      "compareAtPrice": 600,\n      "quantity": 50,\n      "sku": "EAR-SPORT-01",\n      "status": "ACTIVE",\n      "options": [],\n      "variants": []\n    }\n  }\n}`
  },
  {
    name: 'collections',
    type: 'Query',
    description: 'استعلام جميع تصنيفات ومجموعات المتجر مع عدد المنتجات.',
    category: 'Collections',
    graphql: `query GetCollections($first: Int) {
  collections(first: $first) {
    edges {
      node {
        id
        title
        handle
        description
        productsCount
      }
    }
  }
}`,
    variables: `{\n  "first": 50\n}`,
    responseExample: `{\n  "data": {\n    "collections": {\n      "edges": [\n        {\n          "node": {\n            "id": "col_1",\n            "title": "الأجهزة الذكية",\n            "handle": "smart-devices",\n            "productsCount": 28\n          }\n        }\n      ]\n    }\n  }\n}`
  },
  {
    name: 'salesAnalytics',
    type: 'Query',
    description: 'استخراج تقارير وإحصائيات المبيعات، الطلبات، ومتوسط قيمة السلة (AOV).',
    category: 'Admin & Analytics',
    graphql: `query GetSalesAnalytics($period: Period!) {
  salesAnalytics(period: $period) {
    totalSales
    ordersCount
    averageOrderValue
    confirmedRate
    topSellingProducts {
      id
      title
      soldCount
      revenue
    }
  }
}`,
    variables: `{\n  "period": "LAST_30_DAYS"\n}`,
    responseExample: `{\n  "data": {\n    "salesAnalytics": {\n      "totalSales": 145000,\n      "ordersCount": 240,\n      "averageOrderValue": 604.16,\n      "confirmedRate": 88.5,\n      "topSellingProducts": [\n        {\n          "id": "prod_5510",\n          "title": "سماعة بلوتوث رياضية",\n          "soldCount": 65,\n          "revenue": 29250\n        }\n      ]\n    }\n  }\n}`
  },
  {
    name: 'orderTags',
    type: 'Query',
    description: 'استرجاع جميع الوسوم المتاحة للطلبات في المتجر.',
    category: 'Orders',
    graphql: `query GetOrderTags {
  orderTags {
    id
    name
    color
    ordersCount
  }
}`,
    variables: `{}` ,
    responseExample: `{\n  "data": {\n    "orderTags": [\n      { "id": "t1", "name": "واتساب-مؤكد", "color": "#10B981", "ordersCount": 142 },\n      { "id": "t2", "name": "بوليصة-صادرة", "color": "#3B82F6", "ordersCount": 98 }\n    ]\n  }\n}`
  }
];

export const WUILT_SAMPLE_APIS: WuiltSampleApi[] = [
  {
    id: 'add-to-cart',
    name: 'AddToCart',
    arabicTitle: 'إضافة منتج إلى السلة (Cart API)',
    description: 'إضافة منتج مع متغيراته والكمية المطلوبة إلى سلة الشراء في المتجر أو اللاندينج بيج.',
    type: 'Mutation',
    category: 'Cart & Checkout',
    query: `mutation AddToCart($input: AddToCartInput!) {
  addToCart(input: $input) {
    cart {
      id
      subtotal
      total
      itemsCount
      items {
        id
        title
        variantTitle
        quantity
        price
        image
      }
    }
  }
}`,
    variables: `{\n  "input": {\n    "productId": "prod_5510",\n    "variantId": "var_901",\n    "quantity": 1\n  }\n}`,
    response: `{\n  "data": {\n    "addToCart": {\n      "cart": {\n        "id": "cart_xyz789",\n        "subtotal": 450,\n        "total": 450,\n        "itemsCount": 1,\n        "items": [\n          {\n            "id": "item_1",\n            "title": "سماعة بلوتوث رياضية",\n            "variantTitle": "أسود",\n            "quantity": 1,\n            "price": 450,\n            "image": "https://cdn.wuilt.com/img1.jpg"\n          }\n        ]\n      }\n    }\n  }\n}`
  },
  {
    id: 'get-cart',
    name: 'GetCart',
    arabicTitle: 'استرجاع محتويات السلة وحساب الإجمالي',
    description: 'قراءة حالة السلة النشطة للعميل مع حساب الخصومات ورسوم الشحن المبدئية.',
    type: 'Query',
    category: 'Cart & Checkout',
    query: `query GetCart($cartId: ID!) {
  cart(id: $cartId) {
    id
    itemsCount
    subtotal
    discountTotal
    total
    items {
      id
      productId
      title
      quantity
      price
    }
  }
}`,
    variables: `{\n  "cartId": "cart_xyz789"\n}`,
    response: `{\n  "data": {\n    "cart": {\n      "id": "cart_xyz789",\n      "itemsCount": 1,\n      "subtotal": 450,\n      "discountTotal": 0,\n      "total": 450,\n      "items": [\n        {\n          "id": "item_1",\n          "productId": "prod_5510",\n          "title": "سماعة بلوتوث رياضية",\n          "quantity": 1,\n          "price": 450\n        }\n      ]\n    }\n  }\n}`
  },
  {
    id: 'apply-promo-code',
    name: 'ApplyPromoCode',
    arabicTitle: 'تطبيق كود الخصم (Promo Code)',
    description: 'التحقق من صلاحية كود الخصم وحسابه تلقائياً على إجمالي السلة.',
    type: 'Mutation',
    category: 'Cart & Checkout',
    query: `mutation ApplyPromoCode($cartId: ID!, $code: String!) {
  applyPromoCode(cartId: $cartId, code: $code) {
    cart {
      id
      discountTotal
      total
      appliedPromoCode {
        code
        discountType
        value
      }
    }
  }
}`,
    variables: `{\n  "cartId": "cart_xyz789",\n  "code": "SUMMER10"\n}`,
    response: `{\n  "data": {\n    "applyPromoCode": {\n      "cart": {\n        "id": "cart_xyz789",\n        "discountTotal": 45,\n        "total": 405,\n        "appliedPromoCode": {\n          "code": "SUMMER10",\n          "discountType": "PERCENTAGE",\n          "value": 10\n        }\n      }\n    }\n  }\n}`
  },
  {
    id: 'checkout-cart',
    name: 'CheckoutCart',
    arabicTitle: 'إتمام الطلب والدفع (Checkout Cart)',
    description: 'تحويل السلة إلى طلب نهائي مع تسجيل عنوان العميل وخيار الدفع (COD أو بطاقة).',
    type: 'Mutation',
    category: 'Cart & Checkout',
    query: `mutation CheckoutCart($input: CheckoutCartInput!) {
  checkoutCart(input: $input) {
    order {
      id
      orderNumber
      total
      status
      paymentStatus
    }
    paymentUrl
  }
}`,
    variables: `{\n  "input": {\n    "cartId": "cart_xyz789",\n    "customer": {\n      "firstName": "أحمد",\n      "lastName": "علي",\n      "phone": "+201012345678",\n      "email": "ahmed@example.com"\n    },\n    "shippingAddress": {\n      "street": "شارع التسعين التجمع الخامس",\n      "city": "القاهرة",\n      "state": "القاهرة"\n    },\n    "paymentMethod": "COD"\n  }\n}`,
    response: `{\n  "data": {\n    "checkoutCart": {\n      "order": {\n        "id": "ord_9901",\n        "orderNumber": "10453",\n        "total": 405,\n        "status": "PENDING",\n        "paymentStatus": "UNPAID"\n      },\n      "paymentUrl": null\n    }\n  }\n}`
  },
  {
    id: 'store-orders',
    name: 'StoreOrders',
    arabicTitle: 'استعلام طلبات المتجر (Store Orders)',
    description: 'قراءة قائمة الطلبات لربطها بأنظمة إدارة الطلبات ومزامنة الواتساب وشركات الشحن.',
    type: 'Query',
    category: 'Orders & Customers',
    query: `query StoreOrders($first: Int, $filter: OrdersFilterInput) {
  orders(first: $first, filter: $filter) {
    edges {
      node {
        id
        orderNumber
        createdAt
        status
        total
        customer {
          firstName
          lastName
          phone
        }
      }
    }
  }
}`,
    variables: `{\n  "first": 20,\n  "filter": {\n    "status": "PENDING"\n  }\n}`,
    response: `{\n  "data": {\n    "orders": {\n      "edges": [\n        {\n          "node": {\n            "id": "ord_9901",\n            "orderNumber": "10453",\n            "createdAt": "2026-09-05T17:00:00Z",\n            "status": "PENDING",\n            "total": 405,\n            "customer": {\n              "firstName": "أحمد",\n              "lastName": "علي",\n              "phone": "+201012345678"\n            }\n          }\n        }\n      ]\n    }\n  }\n}`
  },
  {
    id: 'store-products',
    name: 'StoreProducts',
    arabicTitle: 'استعلام قائمة المنتجات (Store Products)',
    description: 'استرجاع كتالوج المنتجات لبناء صفحات الهبوط أو المزامنة مع المتاجر الخارجية.',
    type: 'Query',
    category: 'Products & Collections',
    query: `query StoreProducts($first: Int) {
  products(first: $first) {
    edges {
      node {
        id
        title
        handle
        price
        compareAtPrice
        quantity
        images {
          url
        }
      }
    }
  }
}`,
    variables: `{\n  "first": 50\n}`,
    response: `{\n  "data": {\n    "products": {\n      "edges": [\n        {\n          "node": {\n            "id": "prod_5510",\n            "title": "سماعة بلوتوث رياضية",\n            "handle": "wireless-sport-earphones",\n            "price": 450,\n            "compareAtPrice": 600,\n            "quantity": 50,\n            "images": [\n              { "url": "https://cdn.wuilt.com/img1.jpg" }\n            ]\n          }\n        }\n      ]\n    }\n  }\n}`
  },
  {
    id: 'get-product-details',
    name: 'GetProductDetails',
    arabicTitle: 'تفاصيل منتج محدد (Get Product Details)',
    description: 'قراءة بيانات صفحة المنتج، المواصفات، المخزون، والخيارات.',
    type: 'Query',
    category: 'Products & Collections',
    query: `query GetProductDetails($id: ID!) {
  product(id: $id) {
    id
    title
    handle
    description
    price
    compareAtPrice
    quantity
    options {
      id
      name
      values
    }
    variants {
      id
      title
      price
      quantity
      sku
    }
    images {
      url
      alt
    }
  }
}`,
    variables: `{\n  "id": "prod_5510"\n}`,
    response: `{\n  "data": {\n    "product": {\n      "id": "prod_5510",\n      "title": "سماعة بلوتوث رياضية",\n      "handle": "wireless-sport-earphones",\n      "description": "سماعة ممتازة",\n      "price": 450,\n      "compareAtPrice": 600,\n      "quantity": 50,\n      "options": [],\n      "variants": [],\n      "images": [\n        { "url": "https://cdn.wuilt.com/img1.jpg", "alt": "سماعة" }\n      ]\n    }\n  }\n}`
  },
  {
    id: 'update-cart-items',
    name: 'UpdateCartItems',
    arabicTitle: 'تعديل كميات عناصر السلة (Update Cart Items)',
    description: 'زيادة أو تقليل كميات المنتجات داخل سلة الشراء.',
    type: 'Mutation',
    category: 'Cart & Checkout',
    query: `mutation UpdateCartItems($cartId: ID!, $items: [UpdateCartItemInput!]!) {
  updateCartItems(cartId: $cartId, items: $items) {
    cart {
      id
      subtotal
      total
      itemsCount
    }
  }
}`,
    variables: `{\n  "cartId": "cart_xyz789",\n  "items": [\n    {\n      "itemId": "item_1",\n      "quantity": 2\n    }\n  ]\n}`,
    response: `{\n  "data": {\n    "updateCartItems": {\n      "cart": {\n        "id": "cart_xyz789",\n        "subtotal": 900,\n        "total": 900,\n        "itemsCount": 2\n      }\n    }\n  }\n}`
  },
  {
    id: 'replace-cart-items',
    name: 'ReplaceCartItems',
    arabicTitle: 'استبدال عناصر السلة بالكامل (Replace Cart Items)',
    description: 'مسح محتويات السلة الحالية وتعيين حزمة منتجات جديدة دفعة واحدة.',
    type: 'Mutation',
    category: 'Cart & Checkout',
    query: `mutation ReplaceCartItems($cartId: ID!, $items: [AddToCartInput!]!) {
  replaceCartItems(cartId: $cartId, items: $items) {
    cart {
      id
      subtotal
      total
      itemsCount
    }
  }
}`,
    variables: `{\n  "cartId": "cart_xyz789",\n  "items": [\n    {\n      "productId": "prod_5510",\n      "quantity": 3\n    }\n  ]\n}`,
    response: `{\n  "data": {\n    "replaceCartItems": {\n      "cart": {\n        "id": "cart_xyz789",\n        "subtotal": 1350,\n        "total": 1350,\n        "itemsCount": 3\n      }\n    }\n  }\n}`
  },
  {
    id: 'create-product',
    name: 'CreateProduct',
    arabicTitle: 'إنشاء منتج جديد (Create Product)',
    description: 'إضافة منتج مع الخيارات والتسعير وإعدادات الشحن.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation CreateProduct($input: ProductInput!) {
  createProduct(input: $input) {
    product {
      id
      title
      price
      quantity
    }
  }
}`,
    variables: `{\n  "input": {\n    "title": "حذاء رياضي مريح",\n    "price": 750,\n    "quantity": 30\n  }\n}`,
    response: `{\n  "data": {\n    "createProduct": {\n      "product": {\n        "id": "prod_6620",\n        "title": "حذاء رياضي مريح",\n        "price": 750,\n        "quantity": 30\n      }\n    }\n  }\n}`
  },
  {
    id: 'update-product',
    name: 'UpdateProduct',
    arabicTitle: 'تحديث بيانات المنتج (Update Product)',
    description: 'تعديل السعر، المخزون، أو الوصف لمنتج موجود.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation UpdateProduct($input: UpdateProductInput!) {
  updateProduct(input: $input) {
    product {
      id
      title
      price
      quantity
    }
  }
}`,
    variables: `{\n  "input": {\n    "id": "prod_6620",\n    "price": 699\n  }\n}`,
    response: `{\n  "data": {\n    "updateProduct": {\n      "product": {\n        "id": "prod_6620",\n        "title": "حذاء رياضي مريح",\n        "price": 699,\n        "quantity": 30\n      }\n    }\n  }\n}`
  },
  {
    id: 'update-product-variant',
    name: 'UpdateProductVariant',
    arabicTitle: 'تحديث متغير المنتج (Update Variant)',
    description: 'تحديث سعر ومخزون متغير محدد (مثل مقاس 42 لون أسود).',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation UpdateProductVariant($input: UpdateVariantInput!) {
  updateVariant(input: $input) {
    variant {
      id
      title
      price
      quantity
    }
  }
}`,
    variables: `{\n  "input": {\n    "id": "var_901",\n    "price": 420,\n    "quantity": 15\n  }\n}`,
    response: `{\n  "data": {\n    "updateVariant": {\n      "variant": {\n        "id": "var_901",\n        "title": "مقاس 42",\n        "price": 420,\n        "quantity": 15\n      }\n    }\n  }\n}`
  },
  {
    id: 'create-collection',
    name: 'CreateCollection',
    arabicTitle: 'إنشاء مجموعة أو تصنيف جديد (Create Collection)',
    description: 'إنشاء تصنيف جديد وتنظيم المنتجات داخله.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation CreateCollection($input: CollectionInput!) {
  createCollection(input: $input) {
    collection {
      id
      title
      handle
    }
  }
}`,
    variables: `{\n  "input": {\n    "title": "عروض الجمعة البيضاء",\n    "handle": "black-friday"\n  }\n}`,
    response: `{\n  "data": {\n    "createCollection": {\n      "collection": {\n        "id": "col_881",\n        "title": "عروض الجمعة البيضاء",\n        "handle": "black-friday"\n      }\n    }\n  }\n}`
  },
  {
    id: 'add-products-to-collection',
    name: 'AddProductsToCollection',
    arabicTitle: 'إضافة منتجات للمجموعة (Add to Collection)',
    description: 'ربط منتجات متعددة بتصنيف أو مجموعة.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation AddProductsToCollection($input: CollectionInput!) {
  addProductsToCollection(input: $input) {
    collection {
      id
      productsCount
    }
  }
}`,
    variables: `{\n  "input": {\n    "collectionId": "col_881",\n    "productIds": ["prod_6620", "prod_5510"]\n  }\n}`,
    response: `{\n  "data": {\n    "addProductsToCollection": {\n      "collection": {\n        "id": "col_881",\n        "productsCount": 2\n      }\n    }\n  }\n}`
  },
  {
    id: 'remove-products-from-collection',
    name: 'RemoveProductsFromCollection',
    arabicTitle: 'حذف منتجات من المجموعة (Remove from Collection)',
    description: 'إلغاء ربط منتجات من تصنيف معين.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation RemoveProductsFromCollection($input: CollectionInput!) {
  removeProductsFromCollection(input: $input) {
    collection {
      id
      productsCount
    }
  }
}`,
    variables: `{\n  "input": {\n    "collectionId": "col_881",\n    "productIds": ["prod_6620"]\n  }\n}`,
    response: `{\n  "data": {\n    "removeProductsFromCollection": {\n      "collection": {\n        "id": "col_881",\n        "productsCount": 1\n      }\n    }\n  }\n}`
  },
  {
    id: 'store-collections',
    name: 'StoreCollections',
    arabicTitle: 'استعلام تصنيفات المتجر (Store Collections)',
    description: 'قراءة كافة التصنيفات لعرضها في قائمة التصفح أو الفلاتر.',
    type: 'Query',
    category: 'Products & Collections',
    query: `query StoreCollections($first: Int) {
  collections(first: $first) {
    edges {
      node {
        id
        title
        handle
        productsCount
      }
    }
  }
}`,
    variables: `{\n  "first": 30\n}`,
    response: `{\n  "data": {\n    "collections": {\n      "edges": [\n        {\n          "node": {\n            "id": "col_881",\n            "title": "عروض الجمعة البيضاء",\n            "handle": "black-friday",\n            "productsCount": 1\n          }\n        }\n      ]\n    }\n  }\n}`
  },
  {
    id: 'create-customer',
    name: 'CreateCustomer',
    arabicTitle: 'تسجيل عميل جديد (Create Customer)',
    description: 'إضافة عميل جديد وتخزين بيانات الاتصال الخاصة به.',
    type: 'Mutation',
    category: 'Orders & Customers',
    query: `mutation CreateCustomer($input: customerUserInput!) {
  createCustomer(input: $input) {
    customer {
      id
      firstName
      lastName
      phone
      email
    }
  }
}`,
    variables: `{\n  "input": {\n    "firstName": "سارة",\n    "lastName": "محمود",\n    "phone": "+201122334455",\n    "email": "sara@example.com"\n  }\n}`,
    response: `{\n  "data": {\n    "createCustomer": {\n      "customer": {\n        "id": "cust_771",\n        "firstName": "سارة",\n        "lastName": "محمود",\n        "phone": "+201122334455",\n        "email": "sara@example.com"\n      }\n    }\n  }\n}`
  },
  {
    id: 'create-product-attribute',
    name: 'CreateProductAttribute',
    arabicTitle: 'إنشاء سمة للمنتج (Create Product Attribute)',
    description: 'إضافة خاصية جديدة مثل الخامة أو النوع.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation CreateProductAttribute($input: CreateProductAttributeInput!) {
  createProductAttribute(input: $input) {
    productAttribute {
      id
      name
    }
  }
}`,
    variables: `{\n  "input": {\n    "name": "مقاومة الماء"\n  }\n}`,
    response: `{\n  "data": {\n    "createProductAttribute": {\n      "productAttribute": {\n        "id": "attr_301",\n        "name": "مقاومة الماء"\n      }\n    }\n  }\n}`
  },
  {
    id: 'create-product-attribute-value',
    name: 'CreateProductAttributeValue',
    arabicTitle: 'إضافة قيمة للسمة (Create Attribute Value)',
    description: 'تعيين قيمة لسمة منتج محددة.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation CreateProductAttributeValue($input: CreateProductAttributeValueInput!) {
  createProductAttributeValue(input: $input) {
    productAttributeValue {
      id
      value
    }
  }
}`,
    variables: `{\n  "input": {\n    "attributeId": "attr_301",\n    "value": "IP68 معيار عالمي"\n  }\n}`,
    response: `{\n  "data": {\n    "createProductAttributeValue": {\n      "productAttributeValue": {\n        "id": "val_910",\n        "value": "IP68 معيار عالمي"\n      }\n    }\n  }\n}`
  },
  {
    id: 'create-product-option',
    name: 'CreateProductOption',
    arabicTitle: 'إنشاء خيار للمنتج (Create Product Option)',
    description: 'إضافة خيار توليد متغيرات كالحجم أو السعة.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation CreateProductOption($input: ProductOptionInput!) {
  createProductOption(input: $input) {
    productOption {
      id
      name
    }
  }
}`,
    variables: `{\n  "input": {\n    "name": "السعة التخزينية"\n  }\n}`,
    response: `{\n  "data": {\n    "createProductOption": {\n      "productOption": {\n        "id": "opt_401",\n        "name": "السعة التخزينية"\n      }\n    }\n  }\n}`
  },
  {
    id: 'create-product-option-value',
    name: 'CreateProductOptionValue',
    arabicTitle: 'إضافة قيمة لخيار المنتج (Create Option Value)',
    description: 'إضافة قيمة مثل 128GB أو 256GB.',
    type: 'Mutation',
    category: 'Products & Collections',
    query: `mutation CreateProductOptionValue($input: ProductOptionValueInput!) {
  createProductOptionValue(input: $input) {
    productOptionValue {
      id
      name
    }
  }
}`,
    variables: `{\n  "input": {\n    "optionId": "opt_401",\n    "name": "256 GB"\n  }\n}`,
    response: `{\n  "data": {\n    "createProductOptionValue": {\n      "productOptionValue": {\n        "id": "val_104",\n        "name": "256 GB"\n      }\n    }\n  }\n}`
  }
];

export const WUILT_ALL_ENUMS = [
  'AbandonedCheckoutSortByField', 'AccountsServiceErrorCodes', 'ActiveFooter', 'AnalyticalAccountType',
  'AramexStatusEnum', 'AssignmentStatus', 'AuthLogSortByField', 'AuthMode', 'AWBLocale', 'AWBType',
  'BusinessType', 'ButtonFontType', 'ButtonTextCase', 'BuyNowButtonDisplay', 'CartStatusEnum', 'CartStepEnum',
  'CategoryType', 'CheckoutFieldOptions', 'CheckoutNotePlacement', 'CheckoutServiceErrorCodes', 'CodStatus',
  'CollectionProductsSortBy', 'CurrencyCode', 'CustomProductSnapshotCategoryType', 'CustomerIdentifier',
  'CustomerServiceErrorCodes', 'CustomerSortByField', 'DateEnum', 'DeductionStage', 'DefaultPhoneMethod',
  'DiscountAppliedOnType', 'DiscountItemsType', 'DiscountSource', 'DiscountStatus', 'DiscountType',
  'DisplayAsEnum', 'DNSRecordType', 'EditOrderHistoryTypes', 'EligibilityReason', 'EmailRecipientEnum',
  'EmailStatus', 'ErrorCode', 'ExchangeType', 'ExtraFlyerFeesCharger', 'FatooraConfigurationAction',
  'FontTypeEnum', 'FulfillStatusEnum', 'GeneralShipmentStatus', 'HandleType', 'ImageContentType',
  'InputFontType', 'LaunchRequestStatus', 'LinkType', 'Locale', 'LogoSize', 'ManualDiscountAppliedOn',
  'ManualDiscountEnum', 'MediaStatus', 'MenuItemType', 'MylerzStatusEnum', 'NameInputOptions',
  'NotificationEventTypeEnum', 'NotificationServiceErrorCodes', 'NotificationSortByField', 'NotificationStatusEnum',
  'OpenPackageCharger', 'OpenPackageSelectedBy', 'OperationType', 'OptionType', 'OrderErrorEnum',
  'OrderEventType', 'OrderHistoryTypes', 'OrderItemSourceType', 'OrderPaymentFilterEnum', 'OrderPaymentStatusEnum',
  'OrderServiceErrors', 'OrderShipmentSortByField', 'OrderSortByField', 'OrderStatusEnum', 'PageSortByFields',
  'PageStatusEnum', 'PaymentCollectionMethod', 'PaymentIntentStatusEnum', 'PaymentMethodEnum', 'PaymentProvider',
  'PaymentSourceType', 'PaymentStatusEnum', 'PayoutDays', 'PayoutSettingsType', 'PayoutSortByField',
  'PayoutStatus', 'PayoutType', 'PickUpLocationStatus', 'PlatformType', 'PricingInterval', 'ProductAttributeType',
  'ProductCollectionSortByField', 'ProductImageZoomBehavior', 'ProductSnapshotStatus', 'ProductSnapshotType',
  'ProductSortByField', 'ProductStatusFilter', 'ProductStatus', 'ProductType', 'PromoCodeStatusEnum',
  'PromoCodeTypeEnum', 'promoCodesSortByField', 'ProviderName', 'RequestStatus', 'RequestType',
  'ReviewStatus', 'ReviewsSortByField', 'SearchByEnum', 'SearchingMechanism', 'SettlementStatus',
  'ShipmentStatus', 'ShipmentType', 'ShippingCompanyEnum', 'ShippingErrors', 'ShippingProviders',
  'ShippingStatusEnum', 'ShippingStatus', 'ShippingZoneSortByField', 'SortOrder', 'SourceType',
  'Status', 'StockError', 'StoreAuthServiceErrorCodes', 'StoreCitiesByField', 'StoreCustomerStatus',
  'StorePageTypeEnum', 'StorePaymentIntentSortByField', 'StorePaymentMethods', 'StorePaymentProviders',
  'StorePaymentsServiceErrorCodes', 'StoreServiceErrorCodes', 'StoreSortByField', 'StoreWebhookEventType',
  'StoreWebhookFormatType', 'TopSellingProductSortOptions', 'TransactionShipmentType', 'TransactionSortByField',
  'TransactionStatus', 'TransactionType', 'VerificationMethod', 'WebhookVersions', 'WuiltPayPaymentMethod',
  'WuiltPayProviders', 'WuiltServicesErrorCodes', 'WuiltShipmentProvider', 'WuiltShipmentStatusEnum',
  'WuiltShipmentWizardStep'
];

export const WUILT_ALL_INPUTS = [
  'AbandonedCheckoutConnectionInput', 'AbandonedCheckoutFilterInput', 'AbandonedCheckoutSettingsInput',
  'AboutInput', 'AboutTranslationInput', 'AddCustomerAddressInput', 'AddressAreaInput', 'AddressInput',
  'adjustItemsQuantityInput', 'AdminCart', 'AmountOffDiscountedInput', 'AmountOffInput',
  'AnalyticalAccountInput', 'AnswerInput', 'ApplyForAccountManagerInput', 'AramexAdditionalInfo',
  'ArchiveProductsInput', 'archiveShippingRateInput', 'archiveShippingZoneInput', 'AssignOptionsToProductInput',
  'attributeValueSelector', 'Attribute', 'AuthLogsConnectionInput', 'AuthLogsFilterInput',
  'backgroundInput', 'BillingDataInput', 'BulkConvertOrderShippingInput', 'BulkCustomProductCategoryTranslationInput',
  'BulkProductAttributeTranslationInput', 'BulkProductAttributeValueTranslationInput', 'BulkProductOptionTranslationInput',
  'BulkProductOptionValueTranslationInput', 'BulkShippingRateTranslationInput', 'ButtonColorsInput', 'ButtonInput',
  'ButtonStyleSettingsInput', 'ButtonTranslationItemInput', 'ButtonsColorsInput', 'ButtonsSettingsInput',
  'BuyNowButtonSettingsInput', 'BuyXGetYDiscountInput', 'CalculateCartInput', 'CalculateItemsDiscountsInput',
  'CalculateSimpleItemDiscountInput', 'CalculateZoneRatesInput', 'CardSourceInput', 'CatalogSearchFilters',
  'ChangeCustomerStatus', 'ChangeStoreAuthMode', 'CheckoutNoteInput', 'CheckoutTranslationInput', 'CityInput',
  'CollectionInput', 'CollectionProductsConnectionInput', 'CollectionTranslationInput', 'ColorsSettingsInput',
  'ContactEditsInput', 'ContactInfoInput', 'ContactInput', 'ConvertOrderShippingAddressInput',
  'ConvertOrderShippingInput', 'CreateContactInfoInput', 'CreateCustomBuildItemInput', 'CreateCustomItemInput',
  'CreateCustomerTagInput', 'CreateItemInput', 'CreateMaterialInput', 'CreateMaterialOrderInput',
  'CreateMediaInput', 'CreateMenuItemInput', 'CreateOrderCustomerInput', 'CreateOrderTagInput',
  'CreatePickUpAdditionalInfo', 'CreatePickupOrderInput', 'CreateProductAttributeInput', 'CreateProductAttributeValueInput',
  'CreateProductReviewInput', 'CreatePromoCodeInput', 'CreateSimpleItemInput', 'CreateStoreInput',
  'CreateStoreMenuInput', 'CreateStorePageInput', 'CreateTemplateInput', 'CustomCityInput', 'CustomCountryInput',
  'CustomItemCategoryInput', 'CustomItemInput', 'CustomProductCategoryInput', 'CustomProductCategorySettingsInput',
  'CustomProductCategoryTranslationInput', 'CustomProductCategoryVariantInput', 'CustomProductDiscountInput',
  'CustomRegionInput', 'CustomStateInput', 'CustomerAddressFilterInput', 'CustomerBuysAmountOffInput',
  'CustomerBuysInput', 'CustomerBuysItemsInput', 'CustomerCountryInput', 'CustomerGetsInput',
  'CustomerGetsItemsInput', 'CustomerSchemaFilterInput', 'CustomerStateInput', 'CustomerTagsInput',
  'customerUserInput', 'customerUserWithoutPasswordInput', 'CustomersConnectionInput', 'CustomersFilterInput',
  'CustomizeCheckoutInput', 'DateFilterInput', 'DateInput', 'DateTimeRangeInput', 'DeviceInfoInput',
  'DeviceRegistrationInput', 'DimensionsInput', 'DiscountInput', 'DiscountScheduleInput', 'DiscountTranslationInput',
  'DnsRecordInput', 'DropshippingProductConnectionInput', 'EasyOrdersImportInput', 'EditOrderInput',
  'EditShippingAddressAreaInput', 'EditShippingDetailsInput', 'editTotalInput', 'EmailRecordInput',
  'EmailSettingsInput', 'EnableProductReviewsInput', 'ExternalCommerceImportInput', 'FatooraConfigurationInput',
  'FilterInput', 'FontInput', 'FooterInput', 'FooterTranslationInput', 'FulfillInput', 'FulfillItemsInput',
  'GeneralColorsInput', 'GenerateAWBsInput', 'GenerateStoreLegalPageInput', 'GeoLocationInput',
  'GetShipmentsCostInput', 'HolidayInput', 'ImageInput', 'ImportProductsInput', 'InfoBarInput',
  'InfoBarTranslationInput', 'InputColorsInput', 'InputFieldSettingsInput', 'InsuranceSettingsInput',
  'ItemData', 'ItemEditsInput', 'ItemsQuantityInput', 'KlaviyoIntegrationSettingsInput', 'LegalPageStoreByHandleInput',
  'LinkInput', 'listCustomerReviewsInput', 'LogoInput', 'LogoSettingsInput', 'LowStockProductsConnectionInput',
  'MailChimpIntegrationSettingsInput', 'MailchimpConfigurationInput', 'MaintenanceModeInput', 'ManualDiscountInput',
  'MappedShippingAddress', 'MarkOrderPaidInput', 'MarkOrdersPaidInput', 'MenuLinkInput', 'MoneyInput',
  'MoveInput', 'MylerzAdditionalInfo', 'NotificationPreferencesUpdateInput', 'NotificationsConnectionInput',
  'NotificationsFilterInput', 'OptimonkIntegrationSettingsInput', 'optionValueSelector', 'OptionsToAssignInput',
  'orderCalculationsInput', 'OrderConfirmationNotesInput', 'OrderHistoryInput', 'OrderItemDiscountDetailsInfoInput',
  'OrderItemDiscountDetailsInput', 'OrderItemInput', 'OrderMaterialShippingDetailsInput', 'OrderSearchBy',
  'OrderSelectedOptionInput', 'OrderShipmentsConnectionInput', 'OrderShipmentsFilterInput', 'OrderUpdateInput',
  'OrdersConnectionInput', 'OrdersFilterInput', 'OrdersToShip', 'PackageDetails', 'PageFilterInput',
  'PagesConnectionInput', 'PaymentEditsInput', 'PaymentMethodInput', 'PaymentSetupInput', 'PaymentSourceInput',
  'PayoutSettingsInput', 'PayoutsAdminFilterInput', 'PayoutsConnectionInput', 'PendingCodByPeriodInput',
  'Period', 'PickUpLocationInput', 'PreviewCreditTopUpProrationInput', 'PreviewReactivationProrationInput',
  'PreviewTierChangeProrationInput', 'PreviewTrialConversionProrationInput', 'PriceRange', 'ProductAttributeFilterInput',
  'ProductAttributeTranslationInput', 'ProductAttributeValueTranslationInput', 'ProductCollectionConnectionInput',
  'ProductCollectionFilterInput', 'ProductCollectionSEOInput', 'ProductDisplaySettingsInput', 'ProductInput',
  'ProductMove', 'ProductOptionInput', 'ProductOptionTranslationInput', 'ProductOptionValueInput',
  'ProductOptionValueTranslationInput', 'ProductOptionsConnectionInput', 'ProductPackageDetailsInput',
  'ProductSEOInput', 'ProductTranslationInput', 'ProductVariantImageInput', 'ProductVariantInput',
  'ProductVariantUpdateInput', 'ProductsConnectionInput', 'ProductsFilterInput', 'PromoCodesConnectionInput',
  'PromoCodesFilterInput', 'ProviderAdditionalInfo', 'QuestionnaireInput', 'RangeInput', 'RegionInput',
  'RemoveItemsInput', 'ReorderItemsInput', 'ResourcePreferenceInput', 'ReviewFilters', 'ReviewManagementInput',
  'ReviewsConnectionInput', 'SchemaFilterInput', 'SearchReviewsInput', 'SelectedVariantInput', 'SendOTPInput',
  'SeoInput', 'ServableZonesInput', 'SetAllowOpenPackageOptionInput', 'ShipOrdersInput', 'ShippingCostInput',
  'ShippingDetailsInput', 'ShippingFeeRecoveryInput', 'ShippingInfoInput', 'ShippingRateInput',
  'ShippingRateTranslationInput', 'shippingRatesFilterInput', 'ShippingRatesInput', 'ShippingZoneInput',
  'ShippingZoneSettingsInput', 'ShippingZonesConnectionInput', 'shippingZonesFilterInput', 'ShopifyImportInput',
  'SimpleItemInput', 'SocialIntegrationSettingsInput', 'SocialLinkInput', 'StateInput', 'StoreBannerInput',
  'StoreBranchLocationInput', 'StoreCheckoutInput', 'storeCitiesConnectionInput', 'StoreConnectionInput',
  'StoreCustomRatesInput', 'StoreDataInput', 'StoreFontsInput', 'StoreFontsTranslationInput',
  'StoreHomeAttributesInput', 'StoreHomeAttributesTranslationInput', 'StoreHomeCollectionsInput',
  'StoreHomeCollectionsTranslationInput', 'StoreHomeHeroInput', 'StoreHomeHeroSliderTranslationInput',
  'StoreHomeHeroTranslationInput', 'StoreHomeProductsInput', 'StoreHomeProductsTranslationInput',
  'StoreLegalPageInput', 'StoreLocationInput', 'StoreMenuItemTranslationInput', 'StorePageTranslationInput',
  'StorePaymentIntentConnectionInput', 'StorePaymentIntentFilterInput', 'StoreSEOInput', 'StoreTranslationInput',
  'StoreUsersConnectionInput', 'StoreWebhookCreateInput', 'StoreWebhookFilterInput', 'StoreWebhookUpdateInput',
  'StoreWuiltPaySettingsInput', 'StoresOrderInput', 'StoresOrdersInput', 'SubmitStoreContactFormInput',
  'SyncCartInput', 'ThemeColorInput', 'ThemeColorsInput', 'TopCustomersConnectionInput',
  'TopSellingProductsConnectionInput', 'TopSellingProductsOptions', 'TopUpWithInstaPayInput',
  'TopUpWithPayfortCardInput', 'TransactionsAdminFilterInput', 'TransactionsConnectionInput',
  'TransactionsFilterInput', 'UpdateBulkActionSettingsInput', 'UpdateCustomerAddressInput',
  'UpdateCustomerTagInput', 'updateCustomerUserAdminInput', 'updateCustomerUserInput', 'UpdateInsuranceSettingsInput',
  'UpdateIntegrationInput', 'UpdateIntegrationInstallationInput', 'UpdateMaterialInput', 'UpdateMenuItemInput',
  'UpdateOrderInput', 'UpdateOrderPromoInput', 'UpdateOrderTagInput', 'UpdatePickUpLocationInput',
  'UpdateProductAttributeInput', 'UpdateProductAttributeValueInput', 'UpdateProductReviewInput',
  'UpdateProductReviewsSettingsInput', 'UpdateProductsStatusInput', 'UpdateProductsVisibilityInput',
  'UpdatePromoCodeInput', 'UpdateShippingFeeRecoverySettingsInput', 'UpdateShippingRateCostInput',
  'updateShippingRateInput', 'updateShippingZoneInput', 'UpdateStockItemInput', 'updateStoreCustomCitiesInput',
  'updateStoreCustomCountriesInput', 'updateStoreCustomRegionsInput', 'updateStoreCustomStatesInput',
  'UpdateStoreInput', 'UpdateStoreLegalPageInput', 'UpdateStoreMenuInput', 'UpdateStorePageInput',
  'UpdateTaxInput', 'UpdateTemplateInput', 'UpdateVariantInput', 'UpdateWuiltShipmentStoreDetailsInput',
  'ValidateAdminCartInput', 'ValidateShippingInfoInput', 'WooCommerceImportInput', 'WuiltShipmentRatesInput',
  'WuiltShipmentStoreDetailsInput', 'WuiltShipmentUpdate', 'WuiltShipmentWizardInput', 'ZoneCityInput',
  'ZoneCityRegionsInput', 'ZoneCountryInput', 'ZoneCountryStateInput', 'ZoneRegionInput',
  'ZoneStateCitiesInput', 'ZoneStateInput'
];

export const WUILT_SCALARS = [
  { name: 'BigInt', description: 'أرقام صحيحة كبيرة تتجاوز نطاق 32-bit (مثل المبالغ المالية الدقيقة أو معرّفات الأنظمة الكبيرة).' },
  { name: 'Boolean', description: 'قيمة منطقية (true / false).' },
  { name: 'ConnectionCursor', description: 'مؤشر تصفح الصفحات (Cursor-based Pagination) في استعلامات GraphQL.' },
  { name: 'ConnectionLimitInt', description: 'الحد الأقصى لعدد السجلات المطلوبة في الطلب الواحد (مثل first: 50).' },
  { name: 'DateTime', description: 'تاريخ ووقت قياسي بتنسيق ISO-8601 (مثل: 2026-09-05T17:40:00Z).' },
  { name: 'Date', description: 'تاريخ ميلادي بصيغة YYYY-MM-DD.' },
  { name: 'Email', description: 'عنوان بريد إلكتروني صالح مع التحقق من الصيغة.' },
  { name: 'Float', description: 'رقم عشري ذو فاصلة عائمة (للأسعار، النسب المئوية والضرائب).' },
  { name: 'HTML', description: 'نص يحتوي على وسوم HTML منسقة (مثل وصف المنتجات أو الشروط والأحكام).' },
  { name: 'ID', description: 'معرّف فريد لا يتكرر للكائنات (مثل معرّف الطلب أو المنتج).' },
  { name: 'Int', description: 'رقم صحيح 32-bit (للكميات والترتيب).' },
  { name: 'JSONObject', description: 'كائن JSON عشوائي غير مقيد لهيكل محدد للبيانات المخصصة والميتا داتا.' },
  { name: 'String', description: 'سلسلة نصية بتنسيق UTF-8 تدعم اللغة العربية والرموز.' },
  { name: 'URL', description: 'رابط ويب كامل ومشفر (HTTPS) لصور المنتجات أو بوالص الشحن.' }
];

export const WUILT_DIRECTIVES = [
  { name: 'include', type: 'Operation Directive', description: 'تضمين حقل معين في الاستعلام فقط إذا تحقق الشرط ($if: Boolean).' },
  { name: 'skip', type: 'Operation Directive', description: 'تخطي واستبعاد حقل معين من الاستعلام إذا كان الشرط صحيحاً ($if: Boolean).' },
  { name: 'deprecated', type: 'Schema Directive', description: 'الإشارة إلى أن الحقل أو القيمة قديمة وستلغى مستقبلاً مع توضيح البديل (reason).' },
  { name: 'oneOf', type: 'Schema Directive', description: 'يقيد مدخلات Input بحيث يقبل قيمة واحدة فقط من بين مجموعة حقول متاحة.' },
  { name: 'specifiedBy', type: 'Schema Directive', description: 'يوفر رابطاً لمواصفات الـ Scalar المخصص (مثل مواصفات RFC للتواريخ أو الـ BigInt).' }
];

export const WUILT_INTERFACES = [
  { name: 'BaseCartItem', description: 'الواجهة الأساسية لعنصر السلة (الاسم، المعرّف، السعر، الكمية).' },
  { name: 'BaseItem', description: 'الواجهة العامة للمنتجات والعناصر القابلة للشراء.' },
  { name: 'Deletable', description: 'واجهة الكائنات التي تدعم الحذف والأرشفة.' },
  { name: 'ICity', description: 'واجهة المدينة الجغرافية لمناطق الشحن والتوصيل.' },
  { name: 'ICountry', description: 'واجهة الدولة ورمز العملة والاتصال.' },
  { name: 'IRegion', description: 'واجهة الإقليم أو المنطقة الإدارية.' },
  { name: 'IState', description: 'واجهة المحافظة أو الولاية.' },
  { name: 'Node', description: 'واجهة Relay القياسية لتعريف أي سجل يحتوي على معرّف فريد global ID.' },
  { name: 'NodeEdge', description: 'واجهة حافة الاتصال في القوائم المقسمة لصفحات (Edges & Cursors).' }
];
