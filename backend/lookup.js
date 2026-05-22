require('dotenv').config();

const funds = [
    'Aditya Birla Sun Life Arbitrage Direct Growth',
    'Aditya Birla Sun Life ELSS Tax Saver Regular',
    'Axis Banking PSU Debt Direct',
    'Axis Bluechip Direct Growth',
    'Axis ELSS Tax Saver Direct',
    'Axis ELSS Tax Saver Regular',
    'Axis Mid Cap Direct',
    'Baroda BNP Paribas ELSS Direct',
    'DSP Large Mid Cap Regular',
    'Edelweiss Small Cap Direct',
    'HDFC Focused Direct',
    'HDFC Mid Cap Direct',
    'ICICI Prudential Large Mid Cap Direct',
    'Kotak Contra Direct',
    'Mirae Asset ELSS Direct',
    'Mirae Asset ELSS Regular',
    'Mirae Asset Large Midcap Direct',
    'Mirae Asset Large Midcap Regular',
    'Mirae Asset Large Cap Direct',
    'Mirae Asset Midcap Direct',
    'Motilal Oswal Nasdaq 100 Direct',
    'Nippon India Focused Equity Direct',
    'Parag Parikh Flexi Cap Direct',
    'Parag Parikh Flexi Cap Regular',
    'SBI Banking Financial Services Direct',
    'SBI Equity Hybrid Direct',
    'SBI Magnum MidCap IDCW Direct',
    'SBI Nifty Index Direct'
];

(async () => {
    for (const name of funds) {
        const res = await fetch('https://api.mfapi.in/mf/search?q=' + encodeURIComponent(name));
        const data = await res.json();
        console.log('\n>>> ' + name);
        data.slice(0, 2).forEach(x => console.log('  [' + x.schemeCode + '] ' + x.schemeName));
        await new Promise(r => setTimeout(r, 300));
    }
})();