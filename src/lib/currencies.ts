// Supported two-decimal currencies match the app's integer-cents money model.
export const CURRENCIES = [
  {code:"ngn",name:"Nigerian naira"},{code:"usd",name:"US dollar"},
  {code:"gbp",name:"British pound"},{code:"eur",name:"Euro"},
  {code:"ghs",name:"Ghanaian cedi"},{code:"zar",name:"South African rand"},
  {code:"kes",name:"Kenyan shilling"},{code:"cad",name:"Canadian dollar"},
  {code:"aud",name:"Australian dollar"},{code:"nzd",name:"New Zealand dollar"},
  {code:"aed",name:"UAE dirham"},{code:"inr",name:"Indian rupee"},
  {code:"chf",name:"Swiss franc"},{code:"sgd",name:"Singapore dollar"},
  {code:"sek",name:"Swedish krona"},{code:"nok",name:"Norwegian krone"},
  {code:"dkk",name:"Danish krone"},{code:"brl",name:"Brazilian real"},
  {code:"mxn",name:"Mexican peso"},{code:"pln",name:"Polish zloty"},
] as const;
