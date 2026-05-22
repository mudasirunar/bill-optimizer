package com.example.aibilloptimizer

import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity

class SignupActivity : AppCompatActivity() {

    private var isPasswordVisible = false
    private var isConfirmPasswordVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_signup)

        val etName = findViewById<EditText>(R.id.et_name)
        val etEmail = findViewById<EditText>(R.id.et_email)
        val etPassword = findViewById<EditText>(R.id.et_password)
        val etConfirmPassword = findViewById<EditText>(R.id.et_confirm_password)
        val btnSignup = findViewById<Button>(R.id.btn_signup)
        val linkLogin = findViewById<TextView>(R.id.link_login)
        
        val btnTogglePassword = findViewById<ImageView>(R.id.btn_toggle_password)
        val btnToggleConfirmPassword = findViewById<ImageView>(R.id.btn_toggle_confirm_password)
        
        val errorLayout = findViewById<LinearLayout>(R.id.error_layout)
        val errorText = findViewById<TextView>(R.id.error_text)

        // Toggle Password visibility
        btnTogglePassword.setOnClickListener {
            if (isPasswordVisible) {
                etPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                btnTogglePassword.setImageResource(android.R.drawable.ic_menu_view)
            } else {
                etPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                btnTogglePassword.setImageResource(android.R.drawable.ic_secure)
            }
            isPasswordVisible = !isPasswordVisible
            etPassword.setSelection(etPassword.text.length)
        }

        // Toggle Confirm Password visibility
        btnToggleConfirmPassword.setOnClickListener {
            if (isConfirmPasswordVisible) {
                etConfirmPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                btnToggleConfirmPassword.setImageResource(android.R.drawable.ic_menu_view)
            } else {
                etConfirmPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                btnToggleConfirmPassword.setImageResource(android.R.drawable.ic_secure)
            }
            isConfirmPasswordVisible = !isConfirmPasswordVisible
            etConfirmPassword.setSelection(etConfirmPassword.text.length)
        }

        // Go back to login
        linkLogin.setOnClickListener {
            finish()
        }

        // SignUp validations
        btnSignup.setOnClickListener {
            val name = etName.text.toString().trim()
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()
            val confirmPassword = etConfirmPassword.text.toString().trim()

            if (name.isEmpty() || email.isEmpty() || password.isEmpty() || confirmPassword.isEmpty()) {
                errorText.text = "Please complete all registration fields."
                errorLayout.visibility = View.VISIBLE
            } else if (password != confirmPassword) {
                errorText.text = "Passwords do not match. Please verify."
                errorLayout.visibility = View.VISIBLE
            } else if (password.length < 6) {
                errorText.text = "Password should be at least 6 characters."
                errorLayout.visibility = View.VISIBLE
            } else {
                errorLayout.visibility = View.GONE
                Toast.makeText(this, "Account Created Successfully! Please Sign In.", Toast.LENGTH_LONG).show()
                finish() // returns to LoginActivity
            }
        }
    }
}
