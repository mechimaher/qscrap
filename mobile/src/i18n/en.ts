/**
 * English Translations for QScrap Mobile App
 */

export const en = {
    // Common
    common: {
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        close: 'Close',
        back: 'Back',
        next: 'Next',
        done: 'Done',
        retry: 'Retry',
        search: 'Search',
        noResults: 'No results found',
        optional: 'Optional',
        required: 'Required',
        qar: 'QAR',
    },

    // Auth
    auth: {
        login: 'Sign In',
        register: 'Register',
        logout: 'Sign Out',
        phone: 'Phone Number',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        fullName: 'Full Name',
        welcomeBack: 'Welcome Back',
        signInContinue: 'Sign in to continue',
        noAccount: "Don't have an account?",
        hasAccount: 'Already have an account?',
        forgotPassword: 'Forgot Password?',
        agreeTerms: 'By signing in, you agree to our',
        termsOfService: 'Terms of Service',
        and: 'and',
        privacyPolicy: 'Privacy Policy',
        logoutConfirm: 'Are you sure you want to sign out?',
        loginFailed: 'Login Failed',
        registerFailed: 'Registration Failed',
    },

    // Navigation
    nav: {
        home: 'New Request',
        requests: 'Requests',
        orders: 'Orders',
        profile: 'Profile',
        support: 'Support',
    },

    // Home / Create Request
    home: {
        title: 'Find Auto Parts',
        subtitle: 'Search parts from verified garages in Qatar',
        carMake: 'Car Make',
        carModel: 'Car Model',
        carYear: 'Car Year',
        vinOptional: 'VIN / Chassis Number (Optional)',
        partCategory: 'Part Category',
        partDescription: 'Part Description',
        partDescriptionPlaceholder: 'Describe the part you need...',
        partNumber: 'Part Number (Optional)',
        deliveryAddress: 'Delivery Address',
        deliveryAddressPlaceholder: 'Enter delivery address...',
        addPhotos: 'Add Photos',
        photosHelp: 'Add photos of the part or your car for better matching',
        submitRequest: 'Submit Request',
        submitting: 'Submitting...',
        requestSubmitted: 'Request Submitted!',
        requestSubmittedMsg: 'You will receive bids from garages shortly',
    },

    // Requests
    requests: {
        title: 'My Requests',
        count: '{{count}} requests',
        noRequests: 'No Requests Yet',
        noRequestsMsg: 'Create your first part request and get bids from verified garages',
        createRequest: 'Create Request',
        noMatching: 'No Matching Requests',
        noMatchingMsg: 'Try adjusting your filters to see more results',
        clearFilters: 'Clear Filters',
        filters: {
            all: 'All',
            active: 'Active',
            withBids: 'With Bids',
            expired: 'Expired',
        },
        bids: '{{count}} bids',
    },

    // Orders
    orders: {
        title: 'My Orders',
        count: '{{count}} orders',
        noOrders: 'No Orders Yet',
        noOrdersMsg: 'When you accept a bid, your order will appear here',
        browseRequests: 'Browse Requests',
        noMatching: 'No Matching Orders',
        noMatchingMsg: 'Try adjusting your filters to see more results',
        clearFilters: 'Clear Filters',
        filters: {
            all: 'All',
            active: 'Active',
            completed: 'Completed',
            cancelled: 'Cancelled',
        },
        trackDelivery: 'Track Delivery',
        confirmDelivery: 'Confirm Delivery',
        writeReview: 'Write Review',
        cancelOrder: 'Cancel Order',
        openDispute: 'Open Dispute',
    },

    // Profile
    profile: {
        title: 'Profile',
        editProfile: 'Edit Profile',
        savedAddresses: 'Saved Addresses',
        addresses: '{{count}} addresses',
        darkMode: 'Dark Mode',
        notifications: 'Notifications',
        enabled: 'Enabled',
        disabled: 'Disabled',
        helpFaq: 'Help & FAQ',
        termsPrivacy: 'Terms of Service',
        privacyPolicy: 'Privacy Policy',
        version: 'Version {{version}}',
        account: 'ACCOUNT',
        preferences: 'PREFERENCES',
        about: 'ABOUT',
    },

    // Support
    support: {
        title: 'Support',
        newTicket: 'New Ticket',
        openTickets: 'Open Tickets',
        closedTickets: 'Closed Tickets',
        noTickets: 'No Support Tickets',
        noTicketsMsg: 'Need help? Create a support ticket',
        createTicket: 'Create Ticket',
        subject: 'Subject',
        message: 'Message',
        typeMessage: 'Type your message...',
        send: 'Send',
    },

    // Status
    status: {
        pending: 'Pending',
        processing: 'Processing',
        active: 'Active',
        completed: 'Completed',
        cancelled: 'Cancelled',
        delivered: 'Delivered',
        outForDelivery: 'On the Way',
        disputed: 'Disputed',
        expired: 'Expired',
    },

    // Onboarding
    onboarding: {
        skip: 'Skip',
        next: 'Next',
        getStarted: 'Get Started',
        slide1Title: 'Find Any Auto Part',
        slide1Desc: 'Search for new or used parts for any car make and model. Our network of verified garages has you covered.',
        slide2Title: 'Get Competitive Bids',
        slide2Desc: 'Post your request and receive multiple bids from trusted suppliers. Compare prices, warranties, and ratings.',
        slide3Title: 'Quality Guaranteed',
        slide3Desc: 'All garages are verified. Parts go through quality checks before delivery. Warranty protection included.',
        slide4Title: 'Fast Delivery',
        slide4Desc: 'Track your order in real-time. Same-day delivery available across Qatar. Hassle-free returns.',
    },

    // Errors
    errors: {
        network: 'No internet connection',
        server: 'Server error. Please try again.',
        unknown: 'Something went wrong',
        required: '{{field}} is required',
        invalidEmail: 'Please enter a valid email',
        invalidPhone: 'Please enter a valid phone number',
        passwordShort: 'Password must be at least 6 characters',
        passwordMismatch: 'Passwords do not match',
    },
};

export type TranslationKeys = typeof en;
export default en;
