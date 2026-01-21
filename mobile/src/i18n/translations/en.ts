// English translations - Base language
export const en = {
    // Navigation
    nav: {
        home: 'Home',
        requests: 'Requests',
        orders: 'Orders',
        profile: 'Profile',
    },

    // Home Screen
    home: {
        welcome: 'Welcome back',
        newRequest: 'New Request',
        activeRequests: 'Active Requests',
        pendingOrders: 'Pending Orders',
        trackOrder: 'Track Order',
        viewAll: 'View All',
        noParts: 'No active requests',
        createFirst: 'Create your first request',
    },

    // Requests Screen
    requests: {
        title: 'My Requests',
        active: 'Active',
        expired: 'Expired',
        noRequests: 'No requests yet',
        createNew: 'Create New Request',
        bids: 'bids',
        noBids: 'No bids yet',
        expires: 'Expires',
        total: 'Total',
    },

    // Orders Screen
    orders: {
        title: 'My Orders',
        all: 'All',
        active: 'Active',
        completed: 'Completed',
        noOrders: 'No orders yet',
        orderNumber: 'Order #',
        trackDelivery: 'Track Delivery',
        confirmDelivery: 'Confirm Delivery',
    },

    // Profile Screen
    profile: {
        title: 'Profile',
        editProfile: 'Edit Profile',
        account: 'Account',
        myAddresses: 'My Addresses',
        paymentMethods: 'Payment Methods',
        notifications: 'Notifications',
        support: 'Support',
        helpCenter: 'Help Center',
        contactUs: 'Contact Us',
        legal: 'Legal',
        privacyPolicy: 'Privacy Policy',
        termsOfService: 'Terms of Service',
        signOut: 'Sign Out',
        deleteAccount: 'Delete Account',
    },

    // Settings Screen
    settings: {
        title: 'Settings',
        notifications: 'Notifications',
        pushNotifications: 'Push Notifications',
        emailNotifications: 'Email Notifications',
        orderUpdates: 'Order Updates',
        soundHaptics: 'Sound & Haptics',
        sounds: 'Sounds',
        hapticFeedback: 'Haptic Feedback',
        appearance: 'Appearance',
        darkMode: 'Dark Mode',
        language: 'Language',
        storage: 'Storage',
        clearCache: 'Clear Cache',
        about: 'About',
        rateApp: 'Rate App',
        version: 'Version',
    },

    // New Request Screen
    newRequest: {
        title: 'New Request',
        carMake: 'Car Make',
        carModel: 'Car Model',
        carYear: 'Year',
        partDescription: 'Part Description',
        partNumber: 'Part Number (Optional)',
        vinNumber: 'VIN Number (Optional)',
        addPhotos: 'Add Photos',
        deliveryAddress: 'Delivery Address',
        selectAddress: 'Select Address',
        submit: 'Submit Request',
        submitting: 'Submitting...',
    },

    // Common
    common: {
        back: 'Back',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        done: 'Done',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        retry: 'Retry',
        yes: 'Yes',
        no: 'No',
        ok: 'OK',
        confirm: 'Confirm',
        qar: 'QAR',
    },

    // Status labels
    status: {
        active: 'Active',
        pending: 'Pending',
        confirmed: 'Confirmed',
        preparing: 'Preparing',
        readyForPickup: 'Ready for Pickup',
        pickedUp: 'Picked Up',
        inTransit: 'On The Way',
        delivered: 'Delivered',
        completed: 'Completed',
        cancelled: 'Cancelled',
        expired: 'Expired',
    },

    // Addresses
    addresses: {
        title: 'Address Book',
        selectAddress: 'Select Address',
        newAddress: 'New Address',
        editAddress: 'Edit Address',
        label: 'Label (e.g. Home, Office)',
        addressText: 'Address',
        default: 'Default',
        noAddresses: 'No addresses saved',
    },

    // Notifications
    notifications: {
        title: 'Notifications',
        noNotifications: 'No Notifications',
        allCaughtUp: "You're all caught up!",
        readAll: 'Read All',
    },

    // Support
    support: {
        title: 'Support',
        newTicket: 'Create New Ticket',
        noTickets: 'No Support Tickets',
        createTicketHelp: 'Create a ticket if you need help',
        subject: 'Subject',
        describeIssue: 'Describe your issue...',
        submitTicket: 'Submit Ticket',
        open: 'Open',
        inProgress: 'In Progress',
        closed: 'Closed',
    },

    // Alerts
    alerts: {
        confirmSignOut: 'Are you sure you want to sign out?',
        confirmDelete: 'Are you sure you want to delete your account? This cannot be undone.',
        clearCacheTitle: 'Clear Cache',
        clearCacheMessage: 'This will clear temporary data. You will remain logged in.',
        selectLanguage: 'Select Language',
        chooseLanguage: 'Choose your preferred language',
    },
};

export type TranslationKeys = typeof en;
