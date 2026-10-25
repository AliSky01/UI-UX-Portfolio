(function () {
    const nativeFetch = window.fetch.bind(window);

    function localDate(offset) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${date.getFullYear()}-${month}-${day}`;
    }

    function jsonResponse(data) {
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    }

    const patients = [
        { id: 5, Patient_ID: 5, name: "Bautista, Manuel", FirstName: "Manuel", LastName: "Bautista", MiddleName: "Torres", age: 76, Age: 76, sex: "male", Sex: "male", diagnosis: "Severe Depression", Diagnosis: "Severe Depression", status: "admitted" },
        { id: 3, Patient_ID: 3, name: "Dela Cruz, Rogelio", FirstName: "Rogelio", LastName: "Dela Cruz", MiddleName: "", age: 73, Age: 73, sex: "male", Sex: "male", diagnosis: "Mild Depression", Diagnosis: "Mild Depression", status: "admitted" },
        { id: 8, Patient_ID: 8, name: "Garcia, Benjamin", FirstName: "Benjamin", LastName: "Garcia", MiddleName: "Aquino", age: 63, Age: 63, sex: "male", Sex: "male", diagnosis: "Dementia with Behavioral Disturbance", Diagnosis: "Dementia with Behavioral Disturbance", status: "admitted" },
        { id: 7, Patient_ID: 7, name: "Kim, Mingyu", FirstName: "Mingyu", LastName: "Kim", MiddleName: "", age: 65, Age: 65, sex: "male", Sex: "male", diagnosis: "Anxiety", Diagnosis: "Anxiety", status: "admitted" },
        { id: 4, Patient_ID: 4, name: "Reyes, Elena", FirstName: "Elena", LastName: "Reyes", MiddleName: "", age: 70, Age: 70, sex: "female", Sex: "female", diagnosis: "Hallucinations", Diagnosis: "Hallucinations", status: "admitted" }
    ];

    const appointments = [
        { Appointment_ID: 31, AppointmentDate: localDate(0), AppointmentTime: "09:00:00", Status: "confirmed", PatientFirstName: "Ricardo", PatientLastName: "Reyes", GuardianFirstName: "Jose", GuardianLastName: "Bautista", GuardianContact: "09171234567", Symptoms: "Frequent forgetfulness" },
        { Appointment_ID: 29, AppointmentDate: localDate(0), AppointmentTime: "11:00:00", Status: "pending", PatientFirstName: "Mingyu", PatientLastName: "Kim", GuardianFirstName: "Jose", GuardianLastName: "Bautista", GuardianContact: "09171234567", Symptoms: "Depression" },
        { Appointment_ID: 28, AppointmentDate: localDate(1), AppointmentTime: "10:00:00", Status: "for admission", PatientFirstName: "Mitch", PatientLastName: "Pinlac", GuardianFirstName: "Keneme", GuardianLastName: "Ewan", GuardianContact: "09180001111", Symptoms: "Consultation" },
        { Appointment_ID: 32, AppointmentDate: localDate(2), AppointmentTime: "08:00:00", Status: "confirmed", PatientFirstName: "Benjamin", PatientLastName: "Garcia", GuardianFirstName: "Jonathan", GuardianLastName: "Bautista", GuardianContact: "09182223333", Symptoms: "Hallucinations and difficulty concentrating" }
    ];

    function userForPage() {
        const path = location.pathname.toLowerCase();
        if (path.includes("/doctor/")) return { firstname: "Joshua", lastname: "Rubio", role: "doctor" };
        if (path.includes("/nurse/")) return { firstname: "Allyssa", lastname: "Mangahas", role: "nurse" };
        if (path.includes("/finance/")) return { firstname: "Ariana", lastname: "Grande", role: "finance" };
        if (path.includes("/receptionist/")) return { firstname: "Ashanti Mitch", lastname: "Pinlac", role: "receptionist" };
        if (path.includes("/registration/")) return { firstname: "Jose", lastname: "Bautista", role: "patient" };
        return { firstname: "Alex", lastname: "Estrellas", role: "admin" };
    }

    function demoFor(url) {
        if (url.includes("get_user.php")) {
            return jsonResponse({ success: true, user: userForPage() });
        }
        if (url.includes("get_doctor_patients.php") || url.includes("get_admin_dashboard_patients.php")) {
            return jsonResponse({ success: true, patients, count: patients.length });
        }
        if (url.includes("get_active_patient_count.php")) {
            return jsonResponse({ success: true, count: patients.length });
        }
        if (url.includes("get_prescription.php")) {
            return jsonResponse({
                success: true,
                prescriptions: [
                    { PatientName: "Manuel Bautista", Medicine: "Paracetamol", Dosage: "10 mg", Frequency: "Every 8 hours", Date: localDate(0), PrescribedByName: "Alex Estrellas" },
                    { PatientName: "Elena Reyes", Medicine: "Paracetamol", Dosage: "500mg", Frequency: "Twice a day", Date: "2026-04-08", PrescribedByName: "Loisa Ambida" },
                    { PatientName: "Rogelio Dela Cruz", Medicine: "Paracetamol", Dosage: "500mg", Frequency: "Twice a day", Date: "2026-04-01", PrescribedByName: "Loisa Ambida" }
                ]
            });
        }
        if (url.includes("get_appointments.php") || url.includes("get_guardians_appointment.php") || url.includes("get_admin_dashboard_appointments.php")) {
            return jsonResponse({ success: true, appointments });
        }
        if (url.includes("get_guardian_admitted_patient.php")) {
            return jsonResponse({ success: true, hasAdmittedPatient: true, patientId: 5 });
        }
        if (url.includes("get_guardian_patient_file.php")) {
            return jsonResponse({
                success: true,
                count: 3,
                patients: [
                    {
                        id: 5,
                        firstName: "Manuel",
                        middleName: "Torres",
                        lastName: "Bautista",
                        fullName: "Manuel Torres Bautista",
                        age: 76,
                        sex: "Male",
                        birthdate: "1949-09-05",
                        address: "Novaliches, Quezon City",
                        status: "admitted",
                        civilStatus: "Married",
                        religion: "Catholic",
                        hobbies: "Walking, Listening to radio",
                        previousOccupation: "Farmer",
                        admissionDateTime: "2026-04-06T03:35:23",
                        attendingPhysician: "Dr. Joshua Rubio",
                        primaryDiagnosis: "Severe Depression",
                        diagnoses: [{ id: 1, diagnosis: "Severe Depression", notes: "", doctor: "Dr. Joshua Rubio", date: "2026-04-05", dateLabel: "April 5, 2026" }],
                        vitals: null,
                        background: null,
                        medicationIntake: [],
                        prescriptions: [{ id: 1, medicine: "Paracetamol", dosage: "10 mg", frequency: "Every 8 hours", duration: "", specialInstructions: "", date: "2026-05-12", dateLabel: "May 12, 2026", prescribedByName: "Alex Estrellas", prescribedByRole: "admin" }],
                        externalMedicine: [],
                        belongings: [],
                        visitors: []
                    },
                    {
                        id: 3,
                        firstName: "Rogelio",
                        middleName: "Santos",
                        lastName: "Dela Cruz",
                        fullName: "Rogelio Santos Dela Cruz",
                        age: 73,
                        sex: "Male",
                        birthdate: "1952-11-15",
                        address: "Quezon City, Metro Manila",
                        status: "admitted",
                        civilStatus: "Married",
                        religion: "Catholic",
                        hobbies: "Watching TV, Gardening",
                        previousOccupation: "Construction Worker",
                        admissionDateTime: "2026-04-01T17:34:11",
                        attendingPhysician: "Dr. Loisa Ambida",
                        primaryDiagnosis: "Mild Depression",
                        diagnoses: [{ id: 2, diagnosis: "Mild Depression", notes: "", doctor: "Dr. Loisa Ambida", date: "2026-04-01", dateLabel: "April 1, 2026" }],
                        vitals: null,
                        background: null,
                        medicationIntake: [],
                        prescriptions: [],
                        externalMedicine: [],
                        belongings: [],
                        visitors: []
                    },
                    {
                        id: 7,
                        firstName: "Mingyu",
                        middleName: "",
                        lastName: "Kim",
                        fullName: "Mingyu Kim",
                        age: 65,
                        sex: "Male",
                        birthdate: "1960-06-08",
                        address: "Novaliches, Quezon City",
                        status: "admitted",
                        civilStatus: "Not recorded",
                        religion: "None",
                        hobbies: "Dancing, Singing",
                        previousOccupation: "Dancer",
                        admissionDateTime: "2026-05-15T22:01:27",
                        attendingPhysician: "Dr. Joshua Rubio",
                        primaryDiagnosis: "Anxiety",
                        diagnoses: [{ id: 3, diagnosis: "Anxiety", notes: "", doctor: "Dr. Joshua Rubio", date: "2026-05-15", dateLabel: "May 15, 2026" }],
                        vitals: null,
                        background: null,
                        medicationIntake: [],
                        prescriptions: [],
                        externalMedicine: [],
                        belongings: [],
                        visitors: []
                    }
                ]
            });
        }
        if (url.includes("get_finance_summary.php")) {
            return jsonResponse({ success: true, income: 13000, unpaidBalance: 61457 });
        }
        if (url.includes("get_patient_billing.php")) {
            return jsonResponse({
                success: true,
                bills: [
                    { Patient_ID: 8, PatientName: "Benjamin Garcia", AdmissionDate: "2026-05-16", TotalBill: 19350, BillingStatus: "Pending" },
                    { Patient_ID: 4, PatientName: "Elena Reyes", AdmissionDate: "2026-04-04", TotalBill: 19559, BillingStatus: "Pending" },
                    { Patient_ID: 5, PatientName: "Manuel Bautista", AdmissionDate: "2026-04-06", TotalBill: 7160, BillingStatus: "Pending" },
                    { Patient_ID: 7, PatientName: "Mingyu Kim", AdmissionDate: "2026-05-15", TotalBill: 18500, BillingStatus: "Pending" },
                    { Patient_ID: 3, PatientName: "Rogelio Dela Cruz", AdmissionDate: "2026-04-01", TotalBill: 12888, BillingStatus: "Pending" }
                ]
            });
        }
        if (url.includes("get_admin_dashboard_activities.php")) {
            return jsonResponse({
                success: true,
                activities: [
                    { type: "medical-intake", icon: "bi-capsule", name: "Manuel Torres Bautista", description: "Medical Intake Updated: paracetamol", timestamp: "2026-05-16T09:00:00", timeKnown: false },
                    { type: "diagnosis", icon: "bi-heart-pulse", name: "Benjamin Aquino Garcia", description: "New Diagnosis: Dementia with Behavioral Disturbance", timestamp: "2026-05-16T10:00:00", timeKnown: false },
                    { type: "diagnosis", icon: "bi-heart-pulse", name: "Mingyu Kim", description: "New Diagnosis: Anxiety", timestamp: "2026-05-15T11:00:00", timeKnown: false }
                ]
            });
        }
        if (url.includes("get_staff_logs.php")) {
            return jsonResponse({
                success: true,
                logs: [
                    { FirstName: "Alex", LastName: "Estrellas", is_online: 1, login_time: `${localDate(0)}T08:02:00`, logout_time: null },
                    { FirstName: "Joshua", LastName: "Rubio", is_online: 1, login_time: `${localDate(0)}T08:15:00`, logout_time: null },
                    { FirstName: "Allyssa", LastName: "Mangahas", is_online: 0, login_time: `${localDate(0)}T07:50:00`, logout_time: `${localDate(0)}T16:05:00` },
                    { FirstName: "Ariana", LastName: "Grande", is_online: 0, login_time: `${localDate(0)}T09:00:00`, logout_time: `${localDate(0)}T17:00:00` }
                ]
            });
        }
        if (url.includes("get_notifications.php") || url.includes("get_user_notifications.php")) {
            return jsonResponse({ success: true, notifications: [], unread_count: 0 });
        }
        return null;
    }

    window.fetch = async function (input, init) {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        const method = ((init && init.method) || (typeof input !== "string" && input && input.method) || "GET").toUpperCase();

        try {
            const response = await nativeFetch(input, init);
            if (method !== "GET" || !url.includes("php/")) {
                return response;
            }

            const text = await response.text();
            let parsed = null;
            try {
                parsed = JSON.parse(text);
            } catch (error) {
                parsed = null;
            }

            if (!parsed || parsed.success === false) {
                const demo = demoFor(url);
                if (demo) return demo;
            }

            return new Response(text, {
                status: response.status,
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            if (method === "GET" && url.includes("php/")) {
                const demo = demoFor(url);
                if (demo) return demo;
            }
            throw error;
        }
    };
})();
