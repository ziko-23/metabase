import {
  restore,
  visitQuestionAdhoc,
  popover,
  sidebar,
  visitQuestion,
  visitDashboard,
  visitIframe,
  dragField,
  leftSidebar,
} from "e2e/support/helpers";

import { SAMPLE_DB_ID } from "e2e/support/cypress_data";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";

const {
  ORDERS,
  ORDERS_ID,
  PRODUCTS,
  PRODUCTS_ID,
  PEOPLE,
  REVIEWS,
  REVIEWS_ID,
} = SAMPLE_DATABASE;

const QUESTION_NAME = "Cypress Pivot Table";
const DASHBOARD_NAME = "Pivot Table Dashboard";

const TEST_CASES = [
  { case: "question", subject: QUESTION_NAME },
  { case: "dashboard", subject: DASHBOARD_NAME },
];

describe("scenarios > visualizations > pivot tables", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
  });

  it("should be created from an ad-hoc question", () => {
    visitQuestionAdhoc({ dataset_query: testQuery, display: "pivot" });

    cy.findByText(/Count by Users? → Source and Products? → Category/); // ad-hoc title

    cy.findByTestId("viz-settings-button").click();
    assertOnPivotSettings();
    cy.get(".Visualization").within(() => {
      assertOnPivotFields();
    });
  });

  it("should correctly display saved question", () => {
    createAndVisitTestQuestion();
    cy.get(".Visualization").within(() => {
      assertOnPivotFields();
    });

    // Open Pivot table side-bar
    cy.findByTestId("viz-settings-button").click();

    assertOnPivotSettings();
  });

  it("should not show sub-total data after a switch to other viz type", () => {
    createAndVisitTestQuestion();

    // Switch to "ordinary" table
    cy.findByText("Visualization").click();
    cy.icon("table").should("be.visible").click();

    cy.contains(`Started from ${QUESTION_NAME}`);

    cy.log("Assertions on a table itself");
    cy.get(".Visualization").within(() => {
      cy.findByText(/Users? → Source/);
      cy.findByText("783"); // Affiliate - Doohickey
      cy.findByText("986"); // Twitter - Gizmo
      cy.findByText(/Row totals/i).should("not.exist");
      cy.findByText(/Grand totals/i).should("not.exist");
      cy.findByText("3,520").should("not.exist");
      cy.findByText("4,784").should("not.exist");
      cy.findByText("18,760").should("not.exist");
    });
  });

  it("should allow drill through on cells", () => {
    createAndVisitTestQuestion();
    // open drill-through menu
    cy.findByText("783").click();
    // drill through to orders list
    cy.findByText("View these Orders").click();
    // filters are applied
    cy.findByText("Source is Affiliate");
    cy.findByText("Category is Doohickey");
    // data loads
    cy.findByText("45.04");
  });

  it("should allow drill through on left/top header values", () => {
    createAndVisitTestQuestion();
    // open drill-through menu and filter to that value
    cy.findByText("Doohickey").click();
    popover().within(() => cy.findByText("=").click());
    // filter is applied
    cy.findByText("Category is Doohickey");
    // filter out affiliate as a source
    cy.findByText("Affiliate").click();
    popover().within(() => cy.findByText("≠").click());
    // filter is applied and value is gone from the left header
    cy.findByText("Source is not Affiliate");
    cy.findByText("Affiliate").should("not.exist");
    cy.findByText("3,193"); // new grand total
  });

  it("should rearrange pivoted columns", () => {
    createAndVisitTestQuestion();

    // Open Pivot table side-bar
    cy.findByTestId("viz-settings-button").click();

    // Give it some time to open the side-bar fully before we start dragging
    assertOnPivotSettings();

    // Drag the second aggregate (Product category) from table columns to table rows
    dragField(1, 0);

    // One field should now be empty
    cy.findByText("Drag fields here");

    cy.log("Implicit assertions on a table itself");
    cy.get(".Visualization").within(() => {
      cy.findByText(/Products? → Category/);
      cy.findByText(/Users? → Source/);
      cy.findByText("Count");
      cy.findByText(/Totals for Doohickey/i);
      cy.findByText("3,976");
    });
  });

  it("should be able to use binned numeric dimension as a grouping (metabase#14136)", () => {
    // Sample database Orders > Count by Subtotal: Auto binned
    visitQuestionAdhoc({
      dataset_query: {
        type: "query",
        query: {
          "source-table": ORDERS_ID,
          aggregation: [["count"]],
          breakout: [
            ["field", ORDERS.SUBTOTAL, { binning: { strategy: "default" } }],
          ],
        },
        database: SAMPLE_DB_ID,
      },
      display: "pivot",
      visualization_settings: {},
    });

    cy.get(".Visualization").within(() => {
      cy.findByText("Subtotal");
      cy.findByText("Count");
      cy.findByText("2,720");
      cy.findByText(/Grand totals/i);
      cy.findByText("18,760");
    });
  });

  it("should allow collapsing rows", () => {
    // open a pivot table of order count grouped by source, category x year
    const b1 = ["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }];
    const b2 = [
      "field",
      PRODUCTS.CATEGORY,
      { "source-field": ORDERS.PRODUCT_ID },
    ];
    const b3 = ["field", PEOPLE.SOURCE, { "source-field": ORDERS.USER_ID }];

    visitQuestionAdhoc({
      dataset_query: {
        type: "query",
        query: {
          "source-table": ORDERS_ID,
          aggregation: [["count"]],
          breakout: [b1, b2, b3],
        },
        database: SAMPLE_DB_ID,
      },
      display: "pivot",
      visualization_settings: {
        "pivot_table.column_split": {
          rows: [b2, b3],
          columns: [b1],
          values: [["aggregation", 0]],
        },
      },
    });

    cy.findByText("215"); // see a non-subtotal value

    // click to collapse rows
    cy.findByText("Doohickey").parent().find(".Icon-dash").click();
    cy.findByText("1,352"); // subtotal is still there
    cy.findByText("215").should("not.exist"); // value is hidden

    // click to uncollapse
    cy.findByText("Totals for Doohickey").parent().find(".Icon-add").click();
    cy.findByText("215"); // ...and it's back!

    // collapse the column
    cy.findByText("Product → Category").parent().find(".Icon-dash").click();
    cy.findByText("215").should("not.exist"); // value is hidden
    cy.findByText("294").should("not.exist"); // value in another section is also hidden

    // uncollapse Doohickey
    cy.findByText("Totals for Doohickey").parent().find(".Icon-add").click();
    cy.findByText("215"); // value in doohickey is visible
    cy.findByText("294").should("not.exist"); // the other one is still hidden
  });

  it("should show standalone values when collapsed to the sub-level grouping (metabase#25250)", () => {
    const questionDetails = {
      name: "25250",
      dataset_query: {
        type: "query",
        query: {
          "source-table": ORDERS_ID,
          filter: ["<", ["field", ORDERS.CREATED_AT, null], "2016-06-01"],
          aggregation: [["count"]],
          breakout: [
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }],
            ["field", ORDERS.USER_ID, null],
            ["field", ORDERS.PRODUCT_ID, null],
          ],
        },
        database: SAMPLE_DB_ID,
      },
      display: "pivot",
      visualization_settings: {
        "pivot_table.column_split": {
          rows: [
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }],
            ["field", ORDERS.USER_ID, null],
            ["field", ORDERS.PRODUCT_ID, null],
          ],
          columns: [],
          values: [["aggregation", 0]],
        },
        "pivot_table.collapsed_rows": {
          value: [],
          rows: [
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }],
            ["field", ORDERS.USER_ID, null],
            ["field", ORDERS.PRODUCT_ID, null],
          ],
        },
      },
    };

    visitQuestionAdhoc(questionDetails);
    cy.findByText("1162").should("be.visible");
    // Collapse "User ID" column
    cy.findByText("User ID").parent().find(".Icon-dash").click();
    cy.findByText("Totals for 1162").should("be.visible");

    //Expanding the grouped column should still work
    cy.findByText("Totals for 1162").parent().find(".Icon-add").click();
    cy.findByText("1162").should("be.visible");
    cy.findByText("34").should("be.visible");
  });

  it("should allow hiding subtotals", () => {
    visitQuestionAdhoc({
      dataset_query: testQuery,
      display: "pivot",
      visualization_settings: {
        "pivot_table.column_split": {
          rows: testQuery.query.breakout,
          columns: [],
          values: [],
        },
      },
    });

    cy.findByText(/Count by Users? → Source and Products? → Category/); // ad-hoc title

    cy.findByText("3,520"); // check for one of the subtotals

    // open settings
    cy.findByTestId("viz-settings-button").click();
    assertOnPivotSettings();

    // Confirm that Product -> Category doesn't have the option to hide subtotals
    openColumnSettings(/Product → Category/);
    cy.findByText("Show totals").should("not.be.visible");

    // turn off subtotals for User -> Source
    openColumnSettings(/Users? → Source/);
    cy.findByText("Show totals").parent().find("input").click();

    cy.findByText("3,520").should("not.exist"); // the subtotal has disappeared!
  });

  it("should uncollapse a value when hiding the subtotals", () => {
    const rows = testQuery.query.breakout;
    visitQuestionAdhoc({
      dataset_query: testQuery,
      display: "pivot",
      visualization_settings: {
        "pivot_table.column_split": { rows, columns: [], values: [] },
        "pivot_table.collapsed_rows": { value: ['["Affiliate"]'], rows },
      },
    });

    cy.findByText("899").should("not.exist"); // confirm that "Affiliate" is collapsed
    cy.findByText("3,520"); // affiliate subtotal is visible

    // open settings
    cy.findByTestId("viz-settings-button").click();

    // turn off subtotals for User -> Source
    openColumnSettings(/Users? → Source/);
    cy.findByText("Show totals").parent().find("input").click();

    cy.findByText("3,520").should("not.exist"); // the subtotal isn't there
    cy.findByText("899"); // Affiliate is no longer collapsed
  });

  it("should allow column formatting", () => {
    visitQuestionAdhoc({ dataset_query: testQuery, display: "pivot" });

    cy.findByText(/Count by Users? → Source and Products? → Category/); // ad-hoc title

    cy.findByTestId("viz-settings-button").click();
    assertOnPivotSettings();
    openColumnSettings(/Users? → Source/);

    cy.log("New panel for the column options");
    cy.findByText(/Column title/);

    cy.log("Change the title for this column");
    cy.get("input[id=column_title]").clear().type("ModifiedTITLE").blur();
    cy.findByText("Done").click();
    cy.get(".Visualization").within(() => {
      cy.findByText("ModifiedTITLE");
    });
  });

  it("should allow value formatting", () => {
    visitQuestionAdhoc({ dataset_query: testQuery, display: "pivot" });

    cy.findByText(/Count by Users? → Source and Products? → Category/); // ad-hoc title

    cy.findByTestId("viz-settings-button").click();
    assertOnPivotSettings();
    openColumnSettings(/Count/);

    cy.log("New panel for the column options");
    cy.findByText("Column title");
    cy.findByText("Style");
    cy.findByText("Separator style");

    cy.log("Change the value formatting");
    cy.findByText("Normal").click();
    cy.findByText("Percent").click();
    cy.findByText("Done").click();
    cy.get(".Visualization").within(() => {
      cy.findByText("78,300%");
    });
  });

  it("should not allow sorting of value fields", () => {
    visitQuestionAdhoc({ dataset_query: testQuery, display: "pivot" });

    cy.findByText(/Count by Users? → Source and Products? → Category/); // ad-hoc title

    cy.findByTestId("viz-settings-button").click();
    assertOnPivotSettings();
    openColumnSettings(/Count/);

    cy.findByText(/Sort order/).should("not.be.visible");
  });

  it("should allow sorting fields", () => {
    // Pivot by a single column with many values (100 bins).
    // Having many values hides values that are sorted to the end.
    // This lets us assert on presence of a certain value.
    visitQuestionAdhoc({
      dataset_query: {
        type: "query",
        query: {
          "source-table": ORDERS_ID,
          aggregation: [["count"]],
          breakout: [
            [
              "field",
              ORDERS.TOTAL,
              { binning: { strategy: "num-bins", "num-bins": 100 } },
            ],
          ],
        },
        database: SAMPLE_DB_ID,
      },
      display: "pivot",
    });

    // open settings and expand Total column settings
    cy.findByTestId("viz-settings-button").click();
    openColumnSettings(/Total/);

    // sort descending
    cy.icon("arrow_down").click();
    cy.findByText("158 – 160");
    cy.findByText("8 – 10").should("not.exist");

    // sort ascending
    cy.icon("arrow_up").realClick();
    cy.findByText("8 – 10");
    cy.findByText("158 – 160").should("not.exist");
  });

  it("should display an error message for native queries", () => {
    visitQuestionAdhoc({
      dataset_query: {
        type: "native",
        native: { query: "select 1", "template-tags": {} },
        database: SAMPLE_DB_ID,
      },
      display: "pivot",
      visualization_settings: {},
    });

    cy.findByText("Pivot tables can only be used with aggregated queries.");
  });

  describe("custom columns (metabase#14604)", () => {
    it("should work with custom columns as values", () => {
      visitQuestionAdhoc({
        dataset_query: {
          database: SAMPLE_DB_ID,
          query: {
            "source-table": ORDERS_ID,
            expressions: {
              "Twice Total": ["*", ["field", ORDERS.TOTAL, null], 2],
            },
            aggregation: [
              ["sum", ["field", ORDERS.TOTAL, null]],
              ["sum", ["expression", "Twice Total"]],
            ],
            breakout: [
              ["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }],
            ],
          },
          type: "query",
        },
        display: "pivot",
      });

      // value headings
      cy.findByText("Sum of Total");
      cy.findByText("Sum of Twice Total");

      // check values in the table
      cy.findByText("42,156.87"); // sum of total for 2016
      cy.findByText("84,313.74"); // sum of "twice total" for 2016

      // check grand totals
      cy.findByText("1,510,621.68"); // sum of total grand total
      cy.findByText("3,021,243.37"); // sum of "twice total" grand total
    });

    it("should work with custom columns as pivoted columns", () => {
      visitQuestionAdhoc({
        dataset_query: {
          type: "query",
          query: {
            "source-table": PRODUCTS_ID,
            expressions: {
              category_foo: [
                "concat",
                ["field", PRODUCTS.CATEGORY, null],
                "foo",
              ],
            },
            aggregation: [["count"]],
            breakout: [["expression", "category_foo"]],
          },
          database: SAMPLE_DB_ID,
        },
        display: "pivot",
      });

      cy.findByText("category_foo");
      cy.findByText("Doohickeyfoo");
      cy.findByText("42"); // count of Doohickeyfoo
      cy.findByText("200"); // grand total
    });
  });

  describe("dashboards", () => {
    beforeEach(() => {
      cy.createQuestionAndDashboard({
        questionDetails: {
          name: QUESTION_NAME,
          query: testQuery.query,
          display: "pivot",
        },
        dashboardDetails: {
          name: DASHBOARD_NAME,
        },
        cardDetails: {
          size_x: 12,
          size_y: 8,
        },
      }).then(({ body: { dashboard_id } }) => visitDashboard(dashboard_id));
    });

    it("should display a pivot table on a dashboard (metabase#14465)", () => {
      assertOnPivotFields();
    });

    it("should allow filtering drill through (metabase#14632)", () => {
      assertOnPivotFields();
      cy.findByText("Google").click(); // open drill-through menu
      popover().within(() => cy.findByText("=").click()); // drill with additional filter
      cy.findByText("Source is Google"); // filter was added
      cy.findByText("Row totals"); // it's still a pivot table
      cy.findByText("1,027"); // primary data value
      cy.findByText("3,798"); // subtotal value
    });
  });

  describe("sharing (metabase#14447)", () => {
    beforeEach(() => {
      cy.viewport(1400, 800); // Row totals on embed preview was getting cut off at the normal width
      cy.log("Create a question");

      cy.createQuestionAndDashboard({
        questionDetails: {
          name: QUESTION_NAME,
          query: testQuery.query,
          display: "pivot",
        },
        dashboardDetails: {
          name: DASHBOARD_NAME,
        },
        cardDetails: {
          size_x: 12,
          size_y: 8,
        },
      }).then(({ body: { card_id, dashboard_id } }) => {
        cy.log("Enable sharing on card");
        cy.request("POST", `/api/card/${card_id}/public_link`);

        cy.log("Enable embedding on card");
        cy.request("PUT", `/api/card/${card_id}`, {
          enable_embedding: true,
        });

        cy.log("Enable sharing on dashboard");
        cy.request("POST", `/api/dashboard/${dashboard_id}/public_link`);

        cy.log("Enable embedding on dashboard");
        cy.request("PUT", `/api/dashboard/${dashboard_id}`, {
          enable_embedding: true,
        });

        visitQuestion(card_id);
      });
    });

    TEST_CASES.forEach(test => {
      describe(test.case, () => {
        beforeEach(() => {
          cy.visit("collection/root");
          cy.findByText(test.subject).click();
          cy.icon("share").click();
        });

        it("should display pivot table in a public link", () => {
          cy.findByText("Public link")
            .parent()
            .find("input")
            .invoke("val")
            .then($value => {
              cy.visit($value);
            });
          cy.get(".EmbedFrame-header").contains(test.subject);
          assertOnPivotFields();
        });

        // Skipped to avoid flake
        it.skip("should display pivot table in an embed preview", () => {
          cy.findByText(/Embed in your application/).click();
          // we use preview endpoints when MB is iframed in itself
          cy.findByText(test.subject);
          getIframeBody().within(assertOnPivotFields);
        });

        it("should display pivot table in an embed URL", () => {
          cy.findByText(/Embed in your application/).click();

          cy.findByText("Publish").click();

          // visit the iframe src directly to ensure it's not sing preview endpoints
          visitIframe();

          cy.get(".EmbedFrame-header").contains(test.subject);
          assertOnPivotFields();
        });
      });
    });
  });

  it("should open the download popover (metabase#14750)", () => {
    createAndVisitTestQuestion();
    cy.icon("download").click();
    popover().within(() => cy.findByText("Download full results"));
  });

  it.skip("should work for user without data permissions (metabase#14989)", () => {
    cy.request("POST", "/api/card", {
      name: "14989",
      dataset_query: {
        database: SAMPLE_DB_ID,
        query: {
          "source-table": PRODUCTS_ID,
          aggregation: [["count"]],
          breakout: [
            ["datetime-field", ["field-id", PRODUCTS.CREATED_AT], "year"],
            ["field-id", PRODUCTS.CATEGORY],
          ],
        },
        type: "query",
      },
      display: "pivot",
      visualization_settings: {},
    }).then(({ body: { id: QUESTION_ID } }) => {
      cy.signIn("nodata");
      visitQuestion(QUESTION_ID);
    });

    cy.findByText("Grand totals");
    cy.findByText("Row totals");
    cy.findByText("200");
  });

  it("should work with custom mapping of display values (metabase#14985)", () => {
    cy.intercept("POST", "/api/dataset/pivot").as("datasetPivot");

    cy.log("Remap 'Reviews Rating' display values to custom values");
    cy.request("POST", `/api/field/${REVIEWS.RATING}/dimension`, {
      name: "Rating",
      type: "internal",
      human_readable_field_id: null,
    });

    cy.request("POST", `/api/field/${REVIEWS.RATING}/values`, {
      values: [
        [1, "A"],
        [2, "B"],
        [3, "C"],
        [4, "D"],
        [5, "E"],
      ],
    });

    visitQuestionAdhoc({
      dataset_query: {
        database: SAMPLE_DB_ID,
        query: {
          "source-table": REVIEWS_ID,
          aggregation: [["count"]],
          breakout: [
            ["field-id", REVIEWS.RATING],
            ["datetime-field", ["field-id", REVIEWS.CREATED_AT], "year"],
          ],
        },
        type: "query",
      },
      display: "line",
    });

    cy.findByText("Visualization").click();
    leftSidebar().within(() => {
      // This part is still failing. Uncomment when fixed.
      // cy.findByText("Pivot Table")
      //   .parent()
      //   .should("have.css", "opacity", "1");
      cy.icon("pivot_table").click({ force: true });
    });

    cy.wait("@datasetPivot");
    cy.get(".Visualization").within(() => {
      cy.contains("Row totals");
      cy.findByText("333"); // Row totals for 2018
      cy.findByText("Grand totals");
    });
  });

  it("should show stand-alone row values in grouping when rows are collapsed (metabase#15211)", () => {
    visitQuestionAdhoc({
      dataset_query: {
        type: "query",
        query: {
          "source-table": ORDERS_ID,
          aggregation: [["sum", ["field", ORDERS.DISCOUNT, null]], ["count"]],
          breakout: [
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "day" }],
            ["field", ORDERS.PRODUCT_ID, null],
          ],
          filter: [
            "and",
            [
              "between",
              ["field", ORDERS.CREATED_AT, null],
              "2016-11-09",
              "2016-11-11",
            ],
            ["!=", ["field", ORDERS.PRODUCT_ID, null], 146],
          ],
        },
        database: SAMPLE_DB_ID,
      },
      display: "pivot",
      visualization_settings: {
        "pivot_table.column_split": {
          rows: [
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "day" }],
            ["field", ORDERS.PRODUCT_ID, null],
          ],
          columns: [],
          values: [
            ["aggregation", 0],
            ["aggregation", 1],
          ],
        },
        "pivot_table.collapsed_rows": {
          value: [],
          rows: [
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "day" }],
            ["field", ORDERS.PRODUCT_ID, null],
          ],
        },
      },
    });

    cy.findByText("November 9, 2016");
    cy.findByText("November 10, 2016");
    cy.findByText("November 11, 2016");
    collapseRowsFor("Created At: Day");
    cy.findByText("Totals for November 9, 2016");
    cy.findByText("Totals for November 10, 2016");
    cy.findByText("Totals for November 11, 2016");

    function collapseRowsFor(column_name) {
      cy.findByText(column_name).parent().find(".Icon-dash").click();
    }
  });

  it("should not show subtotals for flat tables", () => {
    visitQuestionAdhoc({
      dataset_query: {
        type: "query",
        query: {
          "source-table": ORDERS_ID,
          aggregation: [["sum", ["field", ORDERS.SUBTOTAL, null]]],
          breakout: [
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }],
            ["field", PRODUCTS.CATEGORY, { "source-field": ORDERS.PRODUCT_ID }],
            ["field", PEOPLE.STATE, { "source-field": ORDERS.USER_ID }],
          ],
          filter: [">", ["field", ORDERS.CREATED_AT, null], "2020-01-01"],
        },
        database: SAMPLE_DB_ID,
      },
      display: "pivot",
      visualization_settings: {
        "pivot_table.column_split": {
          rows: [
            ["field", PEOPLE.STATE, { "source-field": ORDERS.USER_ID }],
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }],
          ],
          columns: [
            ["field", PRODUCTS.CATEGORY, { "source-field": ORDERS.PRODUCT_ID }],
          ],
          values: [["aggregation", 0]],
        },
        "pivot_table.collapsed_rows": {
          value: [],
          rows: [
            ["field", PEOPLE.STATE, { "source-field": ORDERS.USER_ID }],
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }],
          ],
        },
      },
    });

    cy.findAllByText(/Totals for .*/i).should("have.length", 0);
  });

  it("should apply conditional formatting", () => {
    visitQuestionAdhoc({
      dataset_query: {
        type: "query",
        query: {
          "source-table": ORDERS_ID,
          aggregation: [["sum", ["field", ORDERS.SUBTOTAL, null]]],
          breakout: [
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }],
            ["field", PRODUCTS.CATEGORY, { "source-field": ORDERS.PRODUCT_ID }],
            ["field", PEOPLE.STATE, { "source-field": ORDERS.USER_ID }],
          ],
          filter: [">", ["field", ORDERS.CREATED_AT, null], "2020-01-01"],
        },
        database: SAMPLE_DB_ID,
      },
      display: "pivot",
      visualization_settings: {
        "pivot_table.column_split": {
          rows: [
            ["field", PEOPLE.STATE, { "source-field": ORDERS.USER_ID }],
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }],
          ],
          columns: [
            ["field", PRODUCTS.CATEGORY, { "source-field": ORDERS.PRODUCT_ID }],
          ],
          values: [["aggregation", 0]],
        },
        "pivot_table.collapsed_rows": {
          value: [],
          rows: [
            ["field", PEOPLE.STATE, { "source-field": ORDERS.USER_ID }],
            ["field", ORDERS.CREATED_AT, { "temporal-unit": "year" }],
          ],
        },
      },
    });

    cy.findByTestId("viz-settings-button").click();
    cy.findByText("Conditional Formatting").click();

    cy.findByText("Add a rule").click();
    cy.findByTestId("conditional-formatting-value-input").type("70");
    cy.findByText("is equal to").click();
    cy.findByText("is less than or equal to").click();

    cy.contains("[data-testid=pivot-table-cell]", "65.09").should(
      "have.css",
      "background-color",
      "rgba(80, 158, 227, 0.65)",
    );
  });

  it("should sort by metric (metabase#22872)", () => {
    const questionDetails = {
      dataset_query: {
        database: SAMPLE_DB_ID,
        query: {
          "source-table": REVIEWS_ID,
          aggregation: [["count"]],
          breakout: [
            ["field", REVIEWS.RATING, null],
            ["field", REVIEWS.CREATED_AT, { "temporal-unit": "year" }],
          ],
        },
        type: "query",
      },
      display: "pivot",
    };

    visitQuestionAdhoc(questionDetails);

    cy.findByTextEnsureVisible("Created At: Year");
    cy.findByTextEnsureVisible("Row totals");

    assertTopMostRowTotalValue("149");

    cy.icon("notebook").click();

    cy.findByTextEnsureVisible("Sort").click();

    popover().contains("Count").click();
    cy.wait("@pivotDataset");

    cy.button("Visualize").click();

    assertTopMostRowTotalValue("23");

    /**
     * @param { string } value
     */
    function assertTopMostRowTotalValue(value) {
      // Warning: Fragile selector!
      // TODO: refactor once we have a better HTML structure for tables.
      cy.get("[role=rowgroup] > div").eq(5).invoke("text").should("eq", value);
    }
  });

  describe("column resizing", () => {
    const getCellWidth = textEl =>
      textEl.closest("[data-testid=pivot-table-cell]").width();

    it("should persist column sizes in visualization settings", () => {
      visitQuestionAdhoc({ dataset_query: testQuery, display: "pivot" });
      const leftHeaderColHandle = cy
        .findAllByTestId("pivot-table-resize-handle")
        .first();
      const totalHeaderColHandle = cy
        .findAllByTestId("pivot-table-resize-handle")
        .last();

      dragColumnHeader(leftHeaderColHandle, -100);
      dragColumnHeader(totalHeaderColHandle, 100);

      cy.findByTestId("pivot-table").within(() => {
        cy.findByText("User → Source").then($headerTextEl => {
          expect(getCellWidth($headerTextEl)).equal(80); // min width is 80
        });
        cy.findByText("Row totals").then($headerTextEl => {
          expect(getCellWidth($headerTextEl)).equal(200);
        });
      });

      cy.findByTestId("qb-header-action-panel").within(() => {
        cy.findByText("Save").click();
      });

      cy.get("#SaveQuestionModal").within(() => {
        cy.findByText("Save").click();
      });

      cy.get("#QuestionSavedModal").within(() => {
        cy.findByText("Not now").click();
      });

      cy.reload(); // reload to make sure the settings are persisted

      cy.findByTestId("pivot-table").within(() => {
        cy.findByText("User → Source").then($headerTextEl => {
          expect(getCellWidth($headerTextEl)).equal(80);
        });
        cy.findByText("Row totals").then($headerTextEl => {
          expect(getCellWidth($headerTextEl)).equal(200);
        });
      });
    });
  });
});

const testQuery = {
  type: "query",
  query: {
    "source-table": ORDERS_ID,
    aggregation: [["count"]],
    breakout: [
      ["field", PEOPLE.SOURCE, { "source-field": ORDERS.USER_ID }],
      ["field", PRODUCTS.CATEGORY, { "source-field": ORDERS.PRODUCT_ID }],
    ],
  },
  database: SAMPLE_DB_ID,
};

function createAndVisitTestQuestion({ display = "pivot" } = {}) {
  const { query } = testQuery;
  const questionDetails = { name: QUESTION_NAME, query, display };

  cy.createQuestion(questionDetails, { visitQuestion: true });
}

function assertOnPivotSettings() {
  cy.findAllByTestId(/draggable-item/).as("fieldOption");

  cy.log("Implicit side-bar assertions");

  cy.findAllByTestId("pivot-table-setting").eq(0);
  cy.get("@fieldOption")
    .eq(0)
    .contains(/Users? → Source/);
  cy.findAllByTestId("pivot-table-setting").eq(1);
  cy.get("@fieldOption")
    .eq(1)
    .contains(/Products? → Category/);
  cy.findAllByTestId("pivot-table-setting").eq(2);
  cy.get("@fieldOption").eq(2).contains("Count");
}

function assertOnPivotFields() {
  cy.log("Implicit assertions on a table itself");

  cy.findByText(/Users? → Source/);
  cy.findByText(/Row totals/i);
  cy.findByText(/Grand totals/i);
  cy.findByText("3,520");
  cy.findByText("4,784");
  cy.findByText("18,760");
}

function dragColumnHeader(el, xDistance = 50) {
  const HANDLE_WIDTH = xDistance > 0 ? 2 : -2;
  el.then($el => {
    const currentXPos = $el[0].getBoundingClientRect().x;
    el.trigger("mousedown", { which: 1 })
      .trigger("mousemove", {
        clientX: currentXPos + (xDistance + HANDLE_WIDTH),
      })
      .trigger("mouseup");
  });
}

function getIframeBody(selector = "iframe") {
  return cy
    .get(selector)
    .its("0.contentDocument")
    .should("exist")
    .its("body")
    .should("not.be.null")
    .then(cy.wrap);
}

function openColumnSettings(columnName) {
  sidebar()
    .findByText(columnName)
    .siblings("[data-testid$=settings-button]")
    .click();
}
