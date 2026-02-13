// --- Data: Dummy Courses ---
const courses = [
    {
        id: 'btc-101',
        title: 'Bitcoin for Beginners',
        description: 'Learn the fundamentals of Bitcoin, blockchain, and financial sovereignty.',
        image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'ln-dev',
        title: 'Lightning Network Development',
        description: 'Master LND, payment channels, and building Layer 2 applications.',
        image: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'agri-tech',
        title: 'Sustainable Agri-Tech',
        description: 'Empowering farmers with technology and sustainable practices.',
        image: 'https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'clean-water',
        title: 'Clean Water Initiative',
        description: 'Building infrastructure for accessible clean water in remote areas.',
        image: 'https://images.unsplash.com/photo-1538300342682-cf57afb97285?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    }
];

// --- Elements ---
const courseGridView = document.getElementById('courseGridView');
const offrampView = document.getElementById('offrampView');
const donationModal = document.getElementById('donationModal');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const customAmountInput = document.getElementById('customAmount');
const generateInvoiceBtn = document.getElementById('generateInvoiceBtn');
const amountBtns = document.querySelectorAll('.amount-btn');
const modalStatus = document.getElementById('modalStatus');
const modalInvoice = document.getElementById('modalInvoice');
const modalQrCode = document.getElementById('modalQrCode');
const modalInvoiceText = document.getElementById('modalInvoiceText');
const paymentSuccessMsg = document.getElementById('paymentSuccessMsg');

// Nav
const navDonate = document.getElementById('navDonate');
const navOfframp = document.getElementById('navOfframp');

// Off-ramp elements
const bankSelect = document.getElementById('bankSelect');
const getQuoteBtn = document.getElementById('getQuoteBtn');
const offrampAmountInput = document.getElementById('offrampAmount');
const accountNumberInput = document.getElementById('accountNumber');
const accountNameInput = document.getElementById('accountName');
const countrySelect = document.getElementById('countrySelect');
const offrampStatus = document.getElementById('offrampStatus');
const offrampInvoiceContainer = document.getElementById('offrampInvoiceContainer');
const offrampQrCode = document.getElementById('offrampQrCode');

// --- State ---
let selectedCourse = null;
let currentHash = null;
let pollInterval = null;

// --- Initialization ---
function init() {
    renderCourses();
    setupEventListeners();
    // Load banks initially (for off-ramp)
    loadBanks();
}

// --- Render Courses ---
function renderCourses() {
    courseGridView.innerHTML = '';
    courses.forEach(course => {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            <img src="${course.image}" alt="${course.title}" class="course-image">
            <div class="course-content">
                <h3 class="course-title">${course.title}</h3>
                <p class="course-desc">${course.description}</p>
                <button class="btn-primary" onclick="openDonationModal('${course.id}')">Donate</button>
            </div>
        `;
        courseGridView.appendChild(card);
    });
}

// --- Event Listeners ---
function setupEventListeners() {
    // Nav Switching
    navDonate.addEventListener('click', (e) => {
        e.preventDefault();
        courseGridView.style.display = 'grid';
        offrampView.style.display = 'none';
    });

    navOfframp.addEventListener('click', (e) => {
        e.preventDefault();
        courseGridView.style.display = 'none';
        offrampView.style.display = 'block';
    });

    // Modal Close
    closeModalBtn.addEventListener('click', closeDonationModal);
    donationModal.addEventListener('click', (e) => {
        if (e.target === donationModal) closeDonationModal();
    });

    // Amount Buttons
    amountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Deselect all
            amountBtns.forEach(b => b.classList.remove('selected'));
            // Select click
            btn.classList.add('selected');
            // Update custom input
            customAmountInput.value = btn.dataset.amount;
        });
    });

    // Generate Invoice
    generateInvoiceBtn.addEventListener('click', createDonationInvoice);

    // Off-ramp Quote
    getQuoteBtn.addEventListener('click', createOfframpQuote);
}

// --- Modal Logic ---
window.openDonationModal = function (courseId) {
    selectedCourse = courses.find(c => c.id === courseId);
    if (!selectedCourse) return;

    modalTitle.innerText = `Donate to ${selectedCourse.title}`;
    customAmountInput.value = '';
    modalStatus.innerText = '';
    modalInvoice.style.display = 'none';
    paymentSuccessMsg.style.display = 'none';

    // Reset buttons
    amountBtns.forEach(b => b.classList.remove('selected'));

    // Stop any existing polling
    if (pollInterval) clearInterval(pollInterval);

    donationModal.classList.add('open');
};

function closeDonationModal() {
    donationModal.classList.remove('open');
    if (pollInterval) clearInterval(pollInterval);
}

// --- Donation Flow (Backend Integration) ---
async function createDonationInvoice() {
    const amount = customAmountInput.value;
    if (!amount || amount < 1) {
        modalStatus.innerText = 'Please enter a valid amount (min 1 sat)';
        modalStatus.className = 'status-message status-error';
        return;
    }

    modalStatus.innerText = 'Creating invoice...';
    modalStatus.className = 'status-message status-loading';

    try {
        const response = await fetch('/api/invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                description: `Donation for ${selectedCourse.title}`
            })
        });

        if (!response.ok) throw new Error(response.statusText);

        const data = await response.json();

        // Render Invoice
        modalStatus.innerText = 'Scan to Pay';
        modalInvoice.style.display = 'block';
        modalInvoiceText.innerText = data.payment_request;

        if (typeof QRCode !== 'undefined') {
            QRCode.toCanvas(modalQrCode, data.payment_request, { width: 200 }, function (err) {
                if (err) console.error(err);
            });
        }

        currentHash = data.r_hash;
        startPolling(modalStatus, paymentSuccessMsg);

    } catch (error) {
        console.error(error);
        modalStatus.innerText = 'Error creating invoice';
        modalStatus.className = 'status-message status-error';
    }
}

// --- Off-ramp Logic ---
async function loadBanks() {
    try {
        const response = await fetch('/api/banks/ZA');
        const banks = await response.json();
        bankSelect.innerHTML = '<option value="">Select Bank...</option>';
        banks.forEach(bank => {
            const opt = document.createElement('option');
            opt.value = bank;
            opt.text = bank;
            bankSelect.appendChild(opt);
        });
    } catch (e) {
        console.error('Failed to load banks', e);
    }
}

async function createOfframpQuote() {
    const amount = offrampAmountInput.value;
    const bank = bankSelect.value;
    const accNum = accountNumberInput.value;
    const accName = accountNameInput.value;

    if (!amount || !bank || !accNum || !accName) {
        offrampStatus.innerText = 'Please fill all fields';
        offrampStatus.className = 'status-message status-error';
        return;
    }

    offrampStatus.innerText = 'Getting quote...';

    try {
        const response = await fetch('/api/offramp/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                bankName: bank,
                accountNumber: accNum,
                accountName: accName
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || response.statusText);
        }

        const data = await response.json();

        offrampStatus.innerText = `Quote: Pay ${data.amount_sats} sats for ${data.amount_fiat / 100} ZAR`;
        offrampInvoiceContainer.style.display = 'block';
        document.getElementById('offrampInvoiceText').innerText = data.payment_request;

        if (typeof QRCode !== 'undefined') {
            QRCode.toCanvas(offrampQrCode, data.payment_request, { width: 200 }, function (err) {
                if (err) console.error(err);
            });
        }

        // Technically could poll here too if we tracked it in backend
        // For off-ramp simple demo, we stop here or add polling similar to above

    } catch (e) {
        offrampStatus.innerText = `Error: ${e.message}`;
        offrampStatus.className = 'status-message status-error';
    }
}

// --- Polling Helper ---
function startPolling(statusEl, successEl) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        if (!currentHash) return;

        try {
            const res = await fetch(`/api/invoice/${currentHash}`);
            if (res.ok) {
                const data = await res.json();
                if (data.settled) {
                    clearInterval(pollInterval);
                    statusEl.innerText = 'Paid!';
                    statusEl.className = 'status-message status-success';
                    successEl.style.display = 'block';
                    successEl.innerText = `Payment Received! Preimage: ${data.preimage.substring(0, 10)}...`;

                    // You might want to auto-close modal after few seconds
                    setTimeout(() => {
                        // closeDonationModal();
                    }, 5000);
                }
            }
        } catch (e) { console.error(e); }
    }, 3000);
}

// Run
init();
