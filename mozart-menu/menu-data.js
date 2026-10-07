/* TEMPORARY sample data for layout checks — replaced by the transcribed menu */
window.MOZART_MENU = {
  info: { name: "Mozart café · bistro · bar", address: ["Theaterstr. 21", "97070 Würzburg"], phone: "0931 90704686", web: "www.mozart-wuerzburg.de", facebook: "Cafe Mozart Würzburg", hours: { de: "Montag bis Sonntag 9.00 – 23.00 Uhr", en: "Monday to Sunday 9 am – 11 pm" } },
  legend: { allergens: [{ code: "1", de: "glutenhaltiges Getreide*", en: "cereals containing gluten*" }, { code: "1a", de: "Weizen", en: "wheat" }, { code: "3", de: "Eier*", en: "eggs*" }, { code: "7", de: "Milch einschließlich Laktose*", en: "milk incl. lactose*" }], additives: [{ code: "A", de: "mit Farbstoff", en: "with colouring" }], footnote: { de: "* und daraus gewonnene Erzeugnisse", en: "* and products made from them" } },
  sections: [
    { id: "fruehstueck", group: "food", tempo: "Ouvertüre", title: { de: "Frühstück", en: "Breakfast" }, subtitle: { de: "bis 14 Uhr", en: "until 2 pm" }, note: { de: "lecker & gesund in den Tag", en: "a delicious & healthy start to the day" }, groups: [{ title: "", items: [
      { name: { de: "Zimtporridge", en: "Cinnamon porridge" }, allergens: "8a,8c", description: { de: "mit frischen Früchten & Mandelmilch", en: "with fresh fruit & almond milk" }, prices: [{ size: "", price: 7.6 }] },
      { name: { de: "Veganes Frühstück", en: "Vegan breakfast" }, allergens: "1a,1b,6,11", description: { de: "Vollwertbrot mit veganem Soja-Frischkäse, hausgemachtem Hummus & Avocadocreme", en: "wholegrain bread with vegan soy cream cheese, homemade hummus & avocado cream" }, prices: [{ size: "", price: 8.5 }], tags: ["vegan"] }
    ] }, { title: { de: "Rührei aus drei Eiern", en: "Scrambled eggs (three eggs)" }, note: { de: "mit warmem Ciabatta & Butter", en: "with warm ciabatta & butter" }, items: [
      { name: { de: "Rührei Natur", en: "Plain scrambled eggs" }, allergens: "1a,1b,3,11", prices: [{ size: "", price: 6.9 }] },
      { name: { de: "Mit Tomatenwürfeln & Mozzarella", en: "With diced tomato & mozzarella" }, allergens: "7", prices: [{ size: "", price: 8.2 }] }
    ] }] },
    { id: "kaffee", group: "drinks", tempo: "Andante", title: { de: "Kaffeespezialitäten", en: "Coffee specialities" }, groups: [{ title: "", items: [
      { name: { de: "Espresso", en: "Espresso" }, allergens: "C", prices: [{ size: "", price: 2.2 }] },
      { name: { de: "Latte Macchiato", en: "Latte macchiato" }, allergens: "C,7", prices: [{ size: "klein", price: 3.2 }, { size: "groß", price: 4.6 }] }
    ] }] },
    { id: "biere", group: "drinks", tempo: "Maestoso", title: { de: "Biere", en: "Beer" }, groups: [{ title: "", items: [
      { name: { de: "Augustiner Lagerbier", en: "Augustiner lager" }, allergens: "1c", description: { de: "Flasche", en: "bottle" }, prices: [{ size: "0,33l", price: 3.9 }, { size: "0,5l", price: 4.9 }] },
      { name: { de: "Jever Fun alkoholfrei", en: "Jever Fun alcohol-free" }, allergens: "1c", prices: [{ size: "0,33l", price: 3.9 }], tags: ["alkoholfrei"] }
    ] }] }
  ]
};
