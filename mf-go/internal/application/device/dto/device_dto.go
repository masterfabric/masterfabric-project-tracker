package dto

// RegisterDeviceRequest is the input for registering or updating a user device.
type RegisterDeviceRequest struct {
	UserID     string
	DeviceID   string
	Platform   string
	DeviceName string
	Model      string
	Brand      string
	OSName     string
	OSVersion  string
	AppName    string
	AppVersion string
	AppBuild   string
}

// DeviceResponse is the output after registering or listing a device.
type DeviceResponse struct {
	ID         string
	UserID     string
	DeviceID   string
	Platform   string
	DeviceName string
	Model      string
	Brand      string
	OSName     string
	OSVersion  string
	AppName    string
	AppVersion string
	AppBuild   string
	CreatedAt  string
	UpdatedAt  string
}
