// ============================
// SWITCH BETWEEN DONATE & SUPPORT
// ============================
const donationWrapper = document.getElementById('donationWrapper');
const supportWrapper = document.getElementById('supportWrapper');
const showLightning = document.getElementById('showLightning');
const showSupport = document.getElementById('showSupport');

showLightning.addEventListener('click', () => {
    donationWrapper.style.display = 'block';
    supportWrapper.style.display = 'none';
    showLightning.classList.add('active');
    showSupport.classList.remove('active');
});

showSupport.addEventListener('click', () => {
    donationWrapper.style.display = 'none';
    supportWrapper.style.display = 'block';
    showSupport.classList.add('active');
    showLightning.classList.remove('active');
});

// ============================
// HERO DONATE BUTTON
// ============================
const heroDonateBtn = document.getElementById('heroDonateBtn');
heroDonateBtn.addEventListener('click', () => {
    donationWrapper.scrollIntoView({ behavior: 'smooth' });
});

// ============================
// LIGHTNING DONATION FLOW
// ============================
let selectedAmount = 0;
const amountButtons = document.querySelectorAll('.amount-btn');
const customAmountInput = document.getElementById('customAmount');

amountButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedAmount = parseInt(btn.dataset.amount);
        customAmountInput.value = '';
        amountButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
});

customAmountInput.addEventListener('input', () => {
    const val = parseInt(customAmountInput.value);
    selectedAmount = val > 0 ? val : 0;
    amountButtons.forEach(b => b.classList.remove('selected'));
});

document.getElementById('donateNowBtn').addEventListener('click', () => {
    if (selectedAmount < 1) return alert('Enter a valid amount in sats.');

    const invoice = `lnbc${selectedAmount}...mockinvoice`;
    document.getElementById('invoiceText').innerText = invoice;

    const invoiceSection = document.getElementById('invoiceSection');
    invoiceSection.style.display = 'block';
    invoiceSection.style.opacity = 0;

    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '';

    setTimeout(() => {
        new QRCode(qrcodeContainer, {
            text: invoice,
            width: 200,
            height: 200,
            colorDark: "#111827",
            colorLight: "#fdfdfd",
            correctLevel: QRCode.CorrectLevel.H
        });
        invoiceSection.style.transition = 'opacity 0.5s ease';
        invoiceSection.style.opacity = 1;
    }, 50);

    const status = document.getElementById('status');
    const successMessage = document.getElementById('successMessage');
    status.innerText = 'Generating invoice...';
    status.style.display = 'block';
    successMessage.innerText = '';

    setTimeout(() => {
        status.style.display = 'none';
        successMessage.innerText = 'Payment confirmed! ⚡';
    }, 3000);
});

// ============================
// SUPPORT APPLICATION FLOW
// ============================
const applyNowBtn = document.getElementById('applyNowBtn');
const supportStep1 = document.getElementById('supportStep1');
const supportStep2 = document.getElementById('supportStep2');
const supportForm = document.getElementById('supportForm');
const supportSuccess = document.getElementById('supportSuccess');

applyNowBtn.addEventListener('click', () => {
    supportStep1.style.display = 'none';
    supportStep2.style.display = 'block';
    supportStep2.scrollIntoView({ behavior: 'smooth' });
});

supportForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(supportForm);
    const data = {
        fullName: formData.get('fullName'),
        hardshipType: formData.get('hardshipType'),
        walletAddress: formData.get('walletAddress'),
        description: formData.get('description'),
        documents: formData.getAll('supportDocs')
    };

    console.log('Application Submitted:', data);

    supportForm.style.display = 'none';
    supportSuccess.style.display = 'block';
    supportSuccess.scrollIntoView({ behavior: 'smooth' });
});

// ============================
// RESET FLOW ON PAGE LOAD
// ============================
window.addEventListener('load', () => {
    donationWrapper.style.display = 'block';
    supportWrapper.style.display = 'none';
    supportStep1.style.display = 'block';
    supportStep2.style.display = 'none';
    supportSuccess.style.display = 'none';
});
