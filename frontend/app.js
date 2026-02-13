// --- Data: Dummy Courses ---
const courses = [
    {
        id: 'code-africa',
        title: 'Code for Africa',
        description: 'Empowering African youth with coding skills to build the future of the continent.',
        image: 'https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'clean-water',
        title: 'Clean Water Project',
        description: 'Building boreholes to provide accessible clean water to rural communities.',
        image: 'https://images.unsplash.com/photo-1538300342682-cf57afb97285?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'solar-schools',
        title: 'Solar For Schools',
        description: 'Providing renewable solar energy to power education in off-grid areas.',
        image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'sustainable-farming',
        title: 'Sustainable Farming',
        description: 'Supporting smallholder farmers with resources for sustainable agriculture.',
        image: 'https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'limpopo-floods',
        title: 'Limpopo Flood Relief',
        description: 'Emergency aid and rebuilding support for communities affected by floods in Limpopo.',
        image: 'images/Natural_Disaster_2.jpeg'
    },
    {
        id: 'child-households',
        title: 'Child Headed Households',
        description: 'Comprehensive support and mentorship for children leading households alone.',
        image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
    }
];

// --- Elements ---
const courseGridView = document.getElementById('courseGridView');
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
const navSupport = document.getElementById('navSupport');

// --- State ---
let selectedCourse = null;
let currentHash = null;
let pollInterval = null;

// --- Initialization ---
function init() {
    renderCourses();
    setupEventListeners();
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
    // Nav Switching
    navDonate.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveView('donate');
    });

    navSupport.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveView('support');
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

    // Support Flow
    const applyNowBtn = document.getElementById('applyNowBtn');
    const supportStep1 = document.getElementById('supportStep1');
    const supportStep2 = document.getElementById('supportStep2');
    const supportForm = document.getElementById('supportForm');
    const supportSuccess = document.getElementById('supportSuccess');

    if (applyNowBtn) {
        applyNowBtn.addEventListener('click', () => {
            supportStep1.style.display = 'none';
            supportStep2.style.display = 'block';
        });
    }

    if (supportForm) {
        supportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Simulate submission
            const formData = new FormData(supportForm);
            const data = Object.fromEntries(formData.entries());
            console.log('Support Application:', data);

            supportForm.style.display = 'none';
            supportSuccess.style.display = 'block';
        });
    }

}

function setActiveView(view) {
    // Nav Active State
    navDonate.classList.toggle('active', view === 'donate');
    navSupport.classList.toggle('active', view === 'support');

    // View Visibility
    courseGridView.style.display = view === 'donate' ? 'grid' : 'none';
    document.getElementById('supportWrapper').style.display = view === 'support' ? 'block' : 'none';
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

        // Use the server-generated QR code (base64)
        if (data.qr_code_base64) {
            // Find or create image element
            let qrImg = document.getElementById('modalQrImage');
            const canvas = document.getElementById('modalQrCode');

            // If we have a canvas, replace it or hide it. 
            // Better to replace the canvas with an img tag in the HTML, but here we can just create an img if not exists
            if (canvas) {
                canvas.style.display = 'none'; // Hide the old canvas
            }

            if (!qrImg) {
                qrImg = document.createElement('img');
                qrImg.id = 'modalQrImage';
                qrImg.style.display = 'block';
                qrImg.style.margin = '0 auto';
                qrImg.style.maxWidth = '100%';
                // Insert where canvas was or in container
                const container = document.getElementById('modalInvoice');
                container.insertBefore(qrImg, modalInvoiceText);
            } else {
                qrImg.style.display = 'block';
            }

            qrImg.src = `data:image/png;base64,${data.qr_code_base64}`;
        } else {
            console.error('No QR code returned from server');
            modalStatus.innerText = 'Error: No QR code';
        }

        currentHash = data.r_hash;
        startPolling(modalStatus, paymentSuccessMsg);

    } catch (error) {
        console.error(error);
        modalStatus.innerText = 'Error creating invoice';
        modalStatus.className = 'status-message status-error';
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
