package com.example.aibilloptimizer

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity

class ApplianceSimulatorActivity : AppCompatActivity() {

    // Appliance Data Structure
    data class Appliance(
        val id: String,
        val name: String,
        val category: String,
        val watts: Int,
        val iconRes: Int,
        val desc: String
    )

    // Basket Item structure
    data class BasketItem(
        val appliance: Appliance,
        var quantity: Int,
        var hours: Int
    )

    private val catalog = listOf(
        // Cooling
        Appliance("ac_std", "Standard AC 1.5T", "Cooling", 1500, android.R.drawable.presence_video_busy, "Fixed speed compressor"),
        Appliance("ac_inv", "Inverter AC 1.5T", "Cooling", 900, android.R.drawable.presence_video_online, "DC inverter, avg load"),
        Appliance("fan_ac", "Ceiling Fan (AC)", "Cooling", 80, android.R.drawable.ic_menu_rotate, "Standard motor fan"),
        Appliance("fan_dc", "Ceiling Fan (DC)", "Cooling", 35, android.R.drawable.ic_menu_rotate, "Inverter BLDC fan"),
        Appliance("cooler", "Air Cooler", "Cooling", 150, android.R.drawable.ic_menu_slideshow, "Evaporative cooler"),
        
        // Kitchen
        Appliance("fridge_inv", "Fridge (Inverter)", "Kitchen", 120, android.R.drawable.ic_menu_save, "Modern inverter type"),
        Appliance("freezer", "Deep Freezer", "Kitchen", 250, android.R.drawable.ic_menu_save, "Chest type ~2.5kWh"),
        Appliance("microwave", "Microwave Oven", "Kitchen", 1000, android.R.drawable.ic_lock_power_off, "Standard 1000W"),
        Appliance("kettle", "Electric Kettle", "Kitchen", 1500, android.R.drawable.ic_menu_day, "1500W per boil"),
        
        // Utilities
        Appliance("pump", "Water Pump 1HP", "Utilities", 746, android.R.drawable.ic_menu_compass, "Submersible pump"),
        Appliance("geyser", "Electric Geyser", "Utilities", 3000, android.R.drawable.ic_menu_day, "Storage geyser 3kW"),
        Appliance("iron", "Clothes Iron", "Utilities", 1000, android.R.drawable.ic_menu_edit, "1000W dry iron"),
        Appliance("washing", "Washing Machine", "Utilities", 500, android.R.drawable.ic_menu_manage, "Semi-automatic"),
        
        // Entertainment
        Appliance("tv_led", "LED TV 43\"", "Entertainment", 60, android.R.drawable.ic_menu_gallery, "Energy-efficient LED"),
        Appliance("desktop", "Desktop PC", "Entertainment", 250, android.R.drawable.ic_menu_gallery, "With monitor"),
        Appliance("laptop", "Laptop", "Entertainment", 65, android.R.drawable.ic_menu_gallery, "On charger"),
        Appliance("ev", "EV Charger L2", "Entertainment", 7200, android.R.drawable.ic_lock_idle_charging, "Level 2 home charger")
    )

    private val activeBasket = mutableMapOf<String, BasketItem>()
    private var selectedCategory = "Cooling"
    private var baselineUnits = 200

    // Tariffs logic
    private val tariffRates = mapOf(
        "Lifeline" to 7.74,
        "Protected" to 12.34,
        "Standard / Non-Protected" to 33.10
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_appliance_simulator)

        // Breadcrumb go back
        findViewById<View>(R.id.breadcrumb_layout).setOnClickListener {
            finish()
        }

        // ==============================================
        //  1. QUICK BILL CALCULATOR CONTROLLER
        // ==============================================
        val etCalcUnits = findViewById<EditText>(R.id.et_calc_units)
        val etCalcDays = findViewById<EditText>(R.id.et_calc_days)
        val spCalcLoad = findViewById<Spinner>(R.id.sp_calc_load)
        val spCalcCat = findViewById<Spinner>(R.id.sp_calc_cat)

        val layoutCalcIdle = findViewById<LinearLayout>(R.id.layout_calc_idle)
        val layoutCalcResult = findViewById<LinearLayout>(R.id.layout_calc_result)
        val tvCalcTotal = findViewById<TextView>(R.id.tv_calc_total)
        val tvCalcEnergy = findViewById<TextView>(R.id.tv_calc_energy)
        val tvCalcTaxes = findViewById<TextView>(R.id.tv_calc_taxes)

        // Setup Spinner adapters
        val loadOptions = listOf("1 kW — Single Phase", "2 kW", "3 kW", "5 kW — Three Phase", "10 kW", "15 kW")
        val loadAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, loadOptions)
        loadAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spCalcLoad.adapter = loadAdapter

        val catOptions = listOf("Standard / Non-Protected", "Protected", "Lifeline")
        val catAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, catOptions)
        catAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spCalcCat.adapter = catAdapter

        // Recalculator watcher
        val billWatcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                calculateQuickBill(
                    etCalcUnits.text.toString(),
                    etCalcDays.text.toString(),
                    spCalcLoad.selectedItem?.toString(),
                    spCalcCat.selectedItem?.toString(),
                    layoutCalcIdle, layoutCalcResult, tvCalcTotal, tvCalcEnergy, tvCalcTaxes
                )
            }
        }
        etCalcUnits.addTextChangedListener(billWatcher)
        etCalcDays.addTextChangedListener(billWatcher)

        val spinnerListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                calculateQuickBill(
                    etCalcUnits.text.toString(),
                    etCalcDays.text.toString(),
                    spCalcLoad.selectedItem?.toString(),
                    spCalcCat.selectedItem?.toString(),
                    layoutCalcIdle, layoutCalcResult, tvCalcTotal, tvCalcEnergy, tvCalcTaxes
                )
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }
        spCalcLoad.onItemSelectedListener = spinnerListener
        spCalcCat.onItemSelectedListener = spinnerListener


        // ==============================================
        //  2. SANDBOX CATALOG & TABS
        // ==============================================
        val tabCooling = findViewById<TextView>(R.id.tab_cooling)
        val tabKitchen = findViewById<TextView>(R.id.tab_kitchen)
        val tabUtilities = findViewById<TextView>(R.id.tab_utilities)
        val tabEntertainment = findViewById<TextView>(R.id.tab_entertainment)

        val tabList = listOf(tabCooling, tabKitchen, tabUtilities, tabEntertainment)

        tabCooling.setOnClickListener { switchTab("Cooling", tabList) }
        tabKitchen.setOnClickListener { switchTab("Kitchen", tabList) }
        tabUtilities.setOnClickListener { switchTab("Utilities", tabList) }
        tabEntertainment.setOnClickListener { switchTab("Entertainment", tabList) }

        // Render Initial list
        switchTab("Cooling", tabList)

        // Clear Basket Click
        findViewById<TextView>(R.id.btn_clear_basket).setOnClickListener {
            activeBasket.clear()
            updateBasketUI()
            renderCatalog()
            Toast.makeText(this, "Basket Cleared", Toast.LENGTH_SHORT).show()
        }

        // Baseline units input listener
        val etBaseline = findViewById<EditText>(R.id.et_baseline)
        etBaseline.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                baselineUnits = s.toString().toIntOrNull() ?: 200
            }
        })

        // Run simulation action button
        val btnRunSim = findViewById<Button>(R.id.btn_run_sim)
        val compareStrip = findViewById<LinearLayout>(R.id.compare_strip)
        val tvSimResultDesc = findViewById<TextView>(R.id.tv_sim_result_desc)

        btnRunSim.setOnClickListener {
            runActiveBasketSimulation(compareStrip, tvSimResultDesc)
        }
    }

    private fun calculateQuickBill(
        unitsText: String,
        daysText: String,
        loadText: String?,
        categoryText: String?,
        idleView: View,
        resultView: View,
        tvTotal: TextView,
        tvEnergy: TextView,
        tvTaxes: TextView
    ) {
        val units = unitsText.toDoubleOrNull()
        val days = daysText.toIntOrNull() ?: 30
        
        if (units == null || units <= 0 || loadText == null || categoryText == null) {
            idleView.visibility = View.VISIBLE
            resultView.visibility = View.GONE
            return
        }

        idleView.visibility = View.GONE
        resultView.visibility = View.VISIBLE

        // Exact Pakistani NEPRA 2026 Slab rate formula engine
        val rate = when {
            categoryText.contains("Lifeline") -> 7.74
            categoryText.contains("Protected") -> 12.34
            else -> 33.10
        }

        // Fixed charges logic
        val fixed = if (loadText.contains("Three Phase")) 1000.0 else 500.0
        val proratedFactor = days.toDouble() / 30.0
        
        val energyCost = units * rate * proratedFactor
        val taxesAndFca = energyCost * 0.28 // Approx taxes FPA 28%
        val totalBill = energyCost + (fixed * proratedFactor) + taxesAndFca

        tvTotal.text = "Rs. ${String.format("%,.0f", totalBill)}"
        tvEnergy.text = "Rs. ${String.format("%,.0f", energyCost)}"
        tvTaxes.text = "Rs. ${String.format("%,.0f", (fixed * proratedFactor) + taxesAndFca)}"
    }

    private fun switchTab(category: String, tabList: List<TextView>) {
        selectedCategory = category
        
        // Update tabs styling
        for (tab in tabList) {
            val isSelected = tab.text.toString().contains(category)
            if (isSelected) {
                tab.setBackgroundResource(R.drawable.badge_status_live)
                tab.setTextColor(resources.getColor(R.color.emerald_light, theme))
            } else {
                tab.setBackgroundResource(R.drawable.card_emerald_border)
                tab.setTextColor(resources.getColor(R.color.text_dim, theme))
            }
        }

        renderCatalog()
    }

    private fun renderCatalog() {
        val catalogContainer = findViewById<LinearLayout>(R.id.appliance_catalog_container)
        catalogContainer.removeAllViews()

        val filteredList = catalog.filter { it.category == selectedCategory }
        val inflater = LayoutInflater.from(this)

        for (appliance in filteredList) {
            val itemView = inflater.inflate(R.layout.item_appliance_catalog, catalogContainer, false)
            
            val ivIcon = itemView.findViewById<ImageView>(R.id.iv_app_icon)
            val tvName = itemView.findViewById<TextView>(R.id.tv_app_name)
            val tvWatts = itemView.findViewById<TextView>(R.id.tv_app_watts)
            val ivCheckmark = itemView.findViewById<ImageView>(R.id.iv_checkmark)

            ivIcon.setImageResource(appliance.iconRes)
            tvName.text = appliance.name
            
            val wattLabel = if (appliance.watts >= 1000) "${appliance.watts / 1000.0} kW" else "${appliance.watts}W"
            tvWatts.text = "$wattLabel · ${appliance.desc}"

            // Show selected checkmark state
            val isInBasket = activeBasket.containsKey(appliance.id)
            ivCheckmark.visibility = if (isInBasket) View.VISIBLE else View.GONE
            if (isInBasket) {
                itemView.setBackgroundResource(R.drawable.badge_status_live)
            } else {
                itemView.setBackgroundResource(R.drawable.card_emerald_border)
            }

            itemView.setOnClickListener {
                if (isInBasket) {
                    activeBasket.remove(appliance.id)
                    Toast.makeText(this, "${appliance.name} removed from simulation", Toast.LENGTH_SHORT).show()
                } else {
                    activeBasket[appliance.id] = BasketItem(appliance, 1, 8)
                    Toast.makeText(this, "${appliance.name} added (Default: 8 hrs/day)", Toast.LENGTH_SHORT).show()
                }
                updateBasketUI()
                renderCatalog() // Refresh checkmarks
            }

            catalogContainer.addView(itemView)
        }
    }

    private fun updateBasketUI() {
        val emptyLayout = findViewById<LinearLayout>(R.id.layout_basket_empty)
        val itemsContainer = findViewById<LinearLayout>(R.id.basket_items_container)
        val basketFooter = findViewById<LinearLayout>(R.id.basket_footer)
        val tvBasketCount = findViewById<TextView>(R.id.tv_basket_count)

        tvBasketCount.text = "${activeBasket.size} appliance${if (activeBasket.size != 1) "s" else ""} added"

        if (activeBasket.isEmpty()) {
            emptyLayout.visibility = View.VISIBLE
            itemsContainer.visibility = View.GONE
            basketFooter.visibility = View.GONE
            return
        }

        emptyLayout.visibility = View.GONE
        itemsContainer.visibility = View.VISIBLE
        basketFooter.visibility = View.VISIBLE

        itemsContainer.removeAllViews()
        val inflater = LayoutInflater.from(this)

        for (item in activeBasket.values) {
            val basketRow = inflater.inflate(R.layout.item_appliance_basket, itemsContainer, false)
            
            val ivIcon = basketRow.findViewById<ImageView>(R.id.iv_basket_icon)
            val tvName = basketRow.findViewById<TextView>(R.id.tv_basket_name)
            val btnRemove = basketRow.findViewById<ImageView>(R.id.btn_basket_remove)
            
            // Qty
            val btnMinus = basketRow.findViewById<ImageButton>(R.id.btn_qty_minus)
            val btnPlus = basketRow.findViewById<ImageButton>(R.id.btn_qty_plus)
            val tvQty = basketRow.findViewById<TextView>(R.id.tv_qty_num)

            // Hours
            val tvHours = basketRow.findViewById<TextView>(R.id.tv_hours_val)
            val sbHours = basketRow.findViewById<SeekBar>(R.id.sb_usage_hours)

            ivIcon.setImageResource(item.appliance.iconRes)
            tvName.text = item.appliance.name
            tvQty.text = item.quantity.toString()
            tvHours.text = "${item.hours} hrs"
            sbHours.progress = item.hours

            // Remove Listener
            btnRemove.setOnClickListener {
                activeBasket.remove(item.appliance.id)
                updateBasketUI()
                renderCatalog()
            }

            // Qty listeners
            btnMinus.setOnClickListener {
                if (item.quantity > 1) {
                    item.quantity--
                    tvQty.text = item.quantity.toString()
                }
            }
            btnPlus.setOnClickListener {
                item.quantity++
                tvQty.text = item.quantity.toString()
            }

            // SeekBar listener
            sbHours.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    item.hours = progress
                    tvHours.text = "$progress hrs"
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                override fun onStopTrackingTouch(seekBar: SeekBar?) {}
            })

            itemsContainer.addView(basketRow)
        }
    }

    private fun runActiveBasketSimulation(compareView: View, tvDesc: TextView) {
        if (activeBasket.isEmpty()) return

        var totalWatts = 0.0
        var simulatedDailyKwh = 0.0

        for (item in activeBasket.values) {
            val watts = item.appliance.watts.toDouble() * item.quantity
            val dailyKwh = (watts * item.hours) / 1000.0
            
            totalWatts += watts
            simulatedDailyKwh += dailyKwh
        }

        val monthlyAddedKwh = simulatedDailyKwh * 30
        val finalKwh = baselineUnits + monthlyAddedKwh

        // Calculation of pricing change under standard slab tariffs
        val rate = 33.10
        val baselineCost = baselineUnits * rate * 1.28 // With approx tax 28%
        val finalCost = finalKwh * rate * 1.28

        val addedCost = finalCost - baselineCost

        compareView.visibility = View.VISIBLE
        tvDesc.text = "Simulated load adds +${monthlyAddedKwh.toInt()} units.\nYour bill increases from Rs. ${String.format("%,.0f", baselineCost)} to Rs. ${String.format("%,.0f", finalCost)} (+Rs. ${String.format("%,.0f", addedCost)})."
    }
}
