export const getBankNameFromIFSC = (ifsc?: string): string => {
    if (!ifsc) return 'Bank Account';
    const prefix = ifsc.substring(0, 4).toUpperCase();
    const banks: Record<string, string> = {
        HDFC: 'HDFC Bank',
        ICIC: 'ICICI Bank',
        SBIN: 'State Bank of India',
        KKBK: 'Kotak Mahindra Bank',
        UTIB: 'Axis Bank',
        AXIS: 'Axis Bank',
        PYTM: 'Paytm Payments Bank',
        YESB: 'Yes Bank',
        PUNB: 'Punjab National Bank',
        BKID: 'Bank of India',
        BARB: 'Bank of Baroda',
        IDIB: 'Indian Bank',
        CNRB: 'Canara Bank'
    };
    return banks[prefix] || 'Bank Account';
};
